import { EMAIL_MAX_ATTEMPTS } from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outboxRow, type Failures, type Row, type Tables } from "@/lib/email/fake-db";
import { resetMailerWarning } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/service";
import { fakeCronService } from "./fake-db";
import { CONSULTATION_JOBS } from "./consultation-jobs";
import { DOCUMENT_JOBS } from "./document-jobs";
import { HOURLY_JOBS, OUTBOX_BATCH_SIZE, retryOutbox, runJobs, type CronJob } from "./jobs";

const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const NOW = "2026-11-11T12:00:00.000Z";

let tables: Tables;
let logged: ReturnType<typeof vi.spyOn>;

function useService(fail: Failures = {}) {
  vi.mocked(createServiceClient).mockReturnValue(
    fakeCronService(tables, fail) as unknown as ReturnType<typeof createServiceClient>,
  );
}

function seedRow(rest: Row = {}): Row {
  const row = outboxRow(rest);
  tables.email_outbox?.push(row);
  return row;
}

const sentKeys = () =>
  resendSend.mock.calls.map(([, options]) => (options as { idempotencyKey: string }).idempotencyKey);

beforeEach(() => {
  tables = { email_outbox: [], email_templates: [] };
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ now: new Date(NOW) });
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Site <no-reply@example.invalid>");
  resetMailerWarning();
  resendSend.mockReset().mockResolvedValue({ data: { id: "email_1" }, error: null });
  useService();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.mocked(createServiceClient).mockReset();
});

describe("retryOutbox", () => {
  it("retries a failed row and a pending row, and marks them sent", async () => {
    const failed = seedRow({ status: "failed", attempts: 1, last_error: "send_error" });
    const pending = seedRow();
    expect(await retryOutbox()).toEqual({ retried: 2, sent: 2, failed: 0 });
    expect(failed).toMatchObject({ status: "sent", attempts: 2, sent_at: NOW, last_error: null });
    expect(pending).toMatchObject({ status: "sent", attempts: 1, sent_at: NOW });
  });

  it("counts a send that fails again, and keeps the row for the next run", async () => {
    resendSend.mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded" } });
    const row = seedRow({ status: "failed", attempts: 1 });
    expect(await retryOutbox()).toEqual({ retried: 1, sent: 0, failed: 1 });
    expect(row).toMatchObject({
      status: "failed",
      attempts: 2,
      last_error: "rate_limit_exceeded",
    });
  });

  it("leaves a row at the attempt limit and a sent row alone", async () => {
    const spent = seedRow({ status: "failed", attempts: EMAIL_MAX_ATTEMPTS });
    seedRow({ status: "sent", attempts: 1, sent_at: "2026-11-11T10:01:00.000Z" });
    expect(await retryOutbox()).toEqual({ retried: 0, sent: 0, failed: 0 });
    expect(resendSend).not.toHaveBeenCalled();
    expect(spent).toMatchObject({ status: "failed", attempts: EMAIL_MAX_ATTEMPTS });
  });

  it("leaves a row from the last few minutes for the send already in flight", async () => {
    const fresh = seedRow({ created_at: "2026-11-11T11:57:00.000Z" });
    const freshFailed = seedRow({
      status: "failed",
      attempts: 1,
      created_at: "2026-11-11T11:58:00.000Z",
    });
    const old = seedRow({ created_at: "2026-11-11T11:54:00.000Z" });
    expect(await retryOutbox()).toEqual({ retried: 1, sent: 1, failed: 0 });
    expect(fresh).toMatchObject({ status: "pending", attempts: 0 });
    expect(freshFailed).toMatchObject({ status: "failed", attempts: 1 });
    expect(old).toMatchObject({ status: "sent" });
  });

  it("sends one batch, oldest first", async () => {
    const newest = seedRow({ created_at: "2026-11-11T11:00:00.000Z" });
    const rows = Array.from({ length: OUTBOX_BATCH_SIZE }, (_, index) =>
      seedRow({
        created_at: `2026-11-11T09:${String(59 - index).padStart(2, "0")}:00.000Z`,
      }),
    );
    expect(await retryOutbox()).toEqual({
      retried: OUTBOX_BATCH_SIZE,
      sent: OUTBOX_BATCH_SIZE,
      failed: 0,
    });
    expect(sentKeys()[0]).toBe(`email-outbox/${String(rows.at(-1)?.id)}`);
    expect(newest).toMatchObject({ status: "pending", attempts: 0 });
    expect(await retryOutbox()).toEqual({ retried: 1, sent: 1, failed: 0 });
  });

  it("sends each row once when two runs go at the same time", async () => {
    const rows = [seedRow({ status: "failed", attempts: 1 }), seedRow(), seedRow()];
    const [first, second] = await Promise.all([retryOutbox(), retryOutbox()]);
    expect(resendSend).toHaveBeenCalledTimes(rows.length);
    expect(sentKeys().sort()).toEqual(rows.map((row) => `email-outbox/${String(row.id)}`).sort());
    expect(first.sent + second.sent).toBe(rows.length);
    expect(first.retried + second.retried).toBe(rows.length);
    for (const row of rows) expect(row).toMatchObject({ status: "sent" });
  });

  it("tries nothing when the email keys are missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const row = seedRow({ status: "failed", attempts: 1 });
    expect(await retryOutbox()).toEqual({ retried: 0, sent: 0, failed: 0 });
    expect(row).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("throws a code, never the database's message, when the read fails", async () => {
    useService({
      email_outbox: { code: "57014", message: "canceled: someone@example.invalid" },
    });
    await expect(retryOutbox()).rejects.toThrow("email_outbox not read (57014)");
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe("runJobs", () => {
  it("adds up what the jobs report", async () => {
    const jobs: CronJob[] = [
      { name: "a", run: async () => ({ retried: 2, sent: 1, failed: 1 }) },
      { name: "b", run: async () => undefined },
      { name: "c", run: async () => ({ retried: 1, sent: 1 }) },
    ];
    expect(await runJobs(jobs)).toEqual({ retried: 3, sent: 2, failed: 1 });
  });

  it("logs a job that throws by name only, and still runs the next", async () => {
    const next = vi.fn(async () => ({ retried: 1, sent: 1, failed: 0 }));
    const jobs: CronJob[] = [
      {
        name: "broken",
        run: async () => {
          throw new Error("failed for someone@example.invalid");
        },
      },
      { name: "next", run: next },
    ];
    expect(await runJobs(jobs)).toEqual({ retried: 1, sent: 1, failed: 0 });
    expect(next).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith("cron hourly: job broken failed");
  });
});

describe("HOURLY_JOBS", () => {
  it("runs the outbox retry, then every consultation and document job", () => {
    expect(HOURLY_JOBS.map((job) => job.name)).toEqual([
      "retryOutbox",
      ...CONSULTATION_JOBS.map((job) => job.name),
      ...DOCUMENT_JOBS.map((job) => job.name),
    ]);
  });

  it("gives every job its own name, so a failure is logged unambiguously", () => {
    const names = HOURLY_JOBS.map((job) => job.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
