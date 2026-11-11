import { cronHourlyResponseSchema, errorResponseSchema } from "@repo/shared";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCronService, reads } from "@/lib/cron/fake-db";
import { outboxRow, type Row, type Tables } from "@/lib/email/fake-db";
import { resetMailerWarning } from "@/lib/email/resend";
import { createServiceClient } from "@/lib/supabase/service";
import { POST } from "./route";

const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const SECRET = "test-cron-secret";

let tables: Tables;
let logged: ReturnType<typeof vi.spyOn>;

function seedRow(rest: Row = {}): Row {
  const row = outboxRow(rest);
  tables.email_outbox?.push(row);
  return row;
}

function call(authorization?: string) {
  return POST(
    new NextRequest("https://site.test/api/cron/hourly", {
      method: "POST",
      headers: authorization === undefined ? {} : { authorization },
    }),
  );
}

/** Nothing was read, written or sent. */
function expectNoWork(row: Row) {
  expect(createServiceClient).not.toHaveBeenCalled();
  expect(reads.count).toBe(0);
  expect(resendSend).not.toHaveBeenCalled();
  expect(row).toMatchObject({ status: "failed", attempts: 1 });
}

beforeEach(() => {
  tables = { email_outbox: [], email_templates: [] };
  reads.count = 0;
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ now: new Date("2026-11-11T12:00:00.000Z") });
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Site <no-reply@example.invalid>");
  resetMailerWarning();
  resendSend.mockReset().mockResolvedValue({ data: { id: "email_1" }, error: null });
  vi.mocked(createServiceClient).mockImplementation(
    () => fakeCronService(tables) as unknown as ReturnType<typeof createServiceClient>,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.mocked(createServiceClient).mockReset();
});

describe("POST /api/cron/hourly", () => {
  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer wrong-secret"],
    ["the secret without Bearer", SECRET],
    ["a secret that only starts right", `Bearer ${SECRET}x`],
    ["an empty Bearer", "Bearer "],
  ])("refuses %s with 401 and does no work", async (_name, authorization) => {
    const row = seedRow({ status: "failed", attempts: 1 });
    const response = await call(authorization);
    expect(response.status).toBe(401);
    const body = errorResponseSchema.parse(await response.json());
    expect(body.error.code).toBe("unauthenticated");
    expectNoWork(row);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("answers 500 and does no work when CRON_SECRET is %s", async (_name, value) => {
    vi.stubEnv("CRON_SECRET", value);
    const row = seedRow({ status: "failed", attempts: 1 });
    for (const authorization of [undefined, "Bearer ", "Bearer undefined", `Bearer ${SECRET}`]) {
      const response = await call(authorization);
      expect(response.status).toBe(500);
      const body = errorResponseSchema.parse(await response.json());
      expect(body.error.code).toBe("internal_error");
    }
    expectNoWork(row);
    expect(logged).toHaveBeenCalledWith("POST /api/cron/hourly: CRON_SECRET is not set");
  });

  it("retries a failed row, marks it sent and reports it", async () => {
    const row = seedRow({ status: "failed", attempts: 1, last_error: "send_error" });
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(cronHourlyResponseSchema.parse(await response.json())).toEqual({
      retried: 1,
      sent: 1,
      failed: 0,
    });
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(row).toMatchObject({ status: "sent", attempts: 2, last_error: null });
  });

  it("sends nothing on a second call", async () => {
    seedRow({ status: "failed", attempts: 1 });
    await call(`Bearer ${SECRET}`);
    const response = await call(`Bearer ${SECRET}`);
    expect(await response.json()).toEqual({ retried: 0, sent: 0, failed: 0 });
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  it("sends each row once when two calls run at the same time", async () => {
    const rows = [seedRow({ status: "failed", attempts: 1 }), seedRow()];
    const responses = await Promise.all([call(`Bearer ${SECRET}`), call(`Bearer ${SECRET}`)]);
    const reports = await Promise.all(
      responses.map(async (response) => cronHourlyResponseSchema.parse(await response.json())),
    );
    expect(resendSend).toHaveBeenCalledTimes(rows.length);
    expect(reports.reduce((sum, report) => sum + report.sent, 0)).toBe(rows.length);
    for (const row of rows) expect(row).toMatchObject({ status: "sent" });
  });

  it("still answers 200 when the job throws, and logs no personal data", async () => {
    vi.mocked(createServiceClient).mockImplementation(
      () =>
        fakeCronService(tables, {
          email_outbox: { code: "57014", message: "canceled: someone@example.invalid" },
        }) as unknown as ReturnType<typeof createServiceClient>,
    );
    seedRow({ status: "failed", attempts: 1 });
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ retried: 0, sent: 0, failed: 0 });
    expect(logged).toHaveBeenCalledWith("cron hourly: job retryOutbox failed");
    expect(logged.mock.calls.flat().join("\n")).not.toContain("example.invalid");
  });
});
