import type { Tables as DbTables } from "@repo/db";
import { EMAIL_MAX_ATTEMPTS } from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { fakeService, outboxRow, type Failures, type Row, type Tables } from "./fake-db";
import { resetMailerWarning } from "./resend";
import { sendOutboxRow, sendOutboxRows } from "./send";

const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

type OutboxRow = DbTables<"email_outbox">;

let tables: Tables;
let logged: ReturnType<typeof vi.spyOn>;
let warned: ReturnType<typeof vi.spyOn>;

function useService(fail: Failures = {}) {
  vi.mocked(createServiceClient).mockReturnValue(
    fakeService(tables, fail) as unknown as ReturnType<typeof createServiceClient>,
  );
}

/** Stores a row and returns it as a run would have read it. */
function seedRow(rest: Row = {}): OutboxRow {
  const row = outboxRow(rest);
  tables.email_outbox?.push(row);
  return { ...row } as OutboxRow;
}

const storedRow = (index = 0) => tables.email_outbox?.[index];
const loggedText = () =>
  [...logged.mock.calls, ...warned.mock.calls].flat().map(String).join("\n");

beforeEach(() => {
  tables = { email_outbox: [], email_templates: [] };
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Site <no-reply@example.invalid>");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
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

describe("sendOutboxRow", () => {
  it("sends the row from EMAIL_FROM and marks it sent, with sent_at", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-11T12:00:00.000Z") });
    const row = seedRow();
    expect(await sendOutboxRow(row)).toBe("sent");
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(resendSend).toHaveBeenCalledWith(
      {
        from: "Site <no-reply@example.invalid>",
        to: "someone@example.invalid",
        subject: "[Contact message] A question",
        text: expect.stringContaining("Sender Name sent a new message"),
        html: expect.stringContaining('dir="ltr"'),
      },
      { idempotencyKey: `email-outbox/${row.id}` },
    );
    expect(storedRow()).toMatchObject({
      status: "sent",
      sent_at: "2026-11-11T12:00:00.000Z",
      attempts: 1,
      last_error: null,
    });
    expect(logged).not.toHaveBeenCalled();
  });

  it("marks a refused send failed, with one more attempt and Resend's code", async () => {
    resendSend.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 422,
        message: "Invalid `to` field: someone@example.invalid",
      },
    });
    expect(await sendOutboxRow(seedRow({ attempts: 2, status: "failed" }))).toBe("failed");
    expect(storedRow()).toMatchObject({
      status: "failed",
      attempts: 3,
      last_error: "validation_error",
      sent_at: null,
    });
  });

  it("marks a send that throws failed, without throwing", async () => {
    resendSend.mockRejectedValue(new Error("connect to someone@example.invalid failed"));
    await expect(sendOutboxRow(seedRow())).resolves.toBe("failed");
    expect(storedRow()).toMatchObject({
      status: "failed",
      attempts: 1,
      last_error: "send_exception",
    });
  });

  it.each([
    [
      "an error's message",
      () =>
        resendSend.mockResolvedValue({
          data: null,
          error: { name: "validation_error", message: "someone@example.invalid Sender Name" },
        }),
    ],
    [
      "an error code that isn't a code",
      () =>
        resendSend.mockResolvedValue({
          data: null,
          error: { name: "bad address someone@example.invalid", message: "A question" },
        }),
    ],
    ["a thrown error", () => resendSend.mockRejectedValue(new Error("Sender Name: A question"))],
  ])("stores and logs no personal data from %s", async (_name, arrange) => {
    arrange();
    await sendOutboxRow(seedRow());
    const kept = `${String(storedRow()?.last_error)}\n${loggedText()}`;
    expect(kept).not.toMatch(/someone@|example\.invalid|Sender Name|A question/);
    expect(storedRow()?.last_error).toMatch(/^[a-z_]+$/);
  });

  it("doesn't send a row another run already claimed", async () => {
    const row = seedRow();
    // The other run counted its attempt after this run read the row.
    Object.assign(storedRow() ?? {}, { attempts: 1 });
    expect(await sendOutboxRow(row)).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
    expect(storedRow()).toMatchObject({ status: "pending", attempts: 1 });
  });

  it("sends a row once when two runs hold the same copy", async () => {
    const row = seedRow();
    const results = await Promise.all([sendOutboxRow(row), sendOutboxRow({ ...row })]);
    expect(results.sort()).toEqual(["sent", "skipped"]);
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(storedRow()).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("doesn't send a row that was sent after it was read", async () => {
    const row = seedRow({ status: "failed", attempts: 1 });
    Object.assign(storedRow() ?? {}, { status: "sent" });
    expect(await sendOutboxRow(row)).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("skips a sent row", async () => {
    const row = seedRow({ status: "sent", attempts: 1, sent_at: "2026-11-11T10:01:00.000Z" });
    expect(await sendOutboxRow(row)).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
    expect(storedRow()).toMatchObject({ attempts: 1 });
  });

  it("leaves a row at the attempt limit alone", async () => {
    const row = seedRow({
      status: "failed",
      attempts: EMAIL_MAX_ATTEMPTS,
      last_error: "validation_error",
    });
    expect(await sendOutboxRow(row)).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
    expect(storedRow()).toMatchObject({
      status: "failed",
      attempts: EMAIL_MAX_ATTEMPTS,
      last_error: "validation_error",
    });
  });

  it("sends the last allowed attempt", async () => {
    const row = seedRow({ status: "failed", attempts: EMAIL_MAX_ATTEMPTS - 1 });
    expect(await sendOutboxRow(row)).toBe("sent");
    expect(storedRow()).toMatchObject({ status: "sent", attempts: EMAIL_MAX_ATTEMPTS });
  });

  it.each([
    ["RESEND_API_KEY", "EMAIL_FROM"],
    ["EMAIL_FROM", "RESEND_API_KEY"],
  ])("leaves the row pending when %s is missing", async (missing) => {
    vi.stubEnv(missing, "");
    expect(await sendOutboxRow(seedRow())).toBe("skipped");
    expect(await sendOutboxRow(seedRow())).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
    expect(storedRow()).toMatchObject({ status: "pending", attempts: 0, last_error: null });
    expect(warned).toHaveBeenCalledTimes(1);
  });

  it("counts a failed attempt when the template can't be read, and sends nothing", async () => {
    // Only the template read fails: the outbox still answers.
    useService({ email_templates: { code: "57014", message: "timeout" } });
    expect(await sendOutboxRow(seedRow())).toBe("failed");
    expect(resendSend).not.toHaveBeenCalled();
    expect(storedRow()).toMatchObject({
      status: "failed",
      attempts: 1,
      last_error: "template_57014",
    });
  });

  it("skips, without throwing, when the claim fails", async () => {
    useService({ email_outbox: { code: "57014", message: "timeout" } });
    await expect(sendOutboxRow(seedRow())).resolves.toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
    expect(loggedText()).toContain("57014");
  });

  it("answers failed, without throwing, when the client can't be created", async () => {
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error("SUPABASE_SECRET_KEY is not set.");
    });
    await expect(sendOutboxRow(seedRow())).resolves.toBe("failed");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("uses the saved template, in the row's language", async () => {
    tables.email_templates?.push({
      event: "contact_message",
      subject_ar: "[رسالة تواصل] {{subject}}",
      subject_en: "[Contact message] {{subject}}",
      body_ar: "رسالة من {{name}}",
      body_en: "A message from {{name}}",
    });
    await sendOutboxRow(seedRow({ locale: "ar" }));
    expect(resendSend.mock.calls[0]?.[0]).toMatchObject({
      subject: "[رسالة تواصل] A question",
      text: expect.stringContaining("\n\nرسالة من Sender Name\n\n"),
      html: expect.stringContaining('dir="rtl"'),
    });
  });
});

describe("sendOutboxRows", () => {
  it("sends each row in turn, and goes on after a failure", async () => {
    resendSend
      .mockResolvedValueOnce({ data: null, error: { name: "rate_limit_exceeded", message: "" } })
      .mockResolvedValue({ data: { id: "email_2" }, error: null });
    await sendOutboxRows([seedRow(), seedRow()]);
    expect([storedRow(0)?.status, storedRow(1)?.status]).toEqual(["failed", "sent"]);
  });
});
