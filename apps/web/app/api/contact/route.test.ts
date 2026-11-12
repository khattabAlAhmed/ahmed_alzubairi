import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Decision = {
  isErrored: () => boolean;
  isDenied: () => boolean;
  reason: { isRateLimit?: () => boolean; message?: string };
};

const mocks = vi.hoisted(() => ({
  protect: vi.fn(),
  insert: vi.fn(),
  queue: vi.fn(),
  baseOptions: [] as unknown[],
  routeRules: [] as unknown[],
}));

// The real lib/arcjet runs; only the SDK is replaced.
vi.mock("@arcjet/next", () => ({
  default: (options: unknown) => {
    mocks.baseOptions.push(options);
    return {
      withRule: (rule: unknown) => {
        mocks.routeRules.push(rule);
        return { protect: mocks.protect };
      },
    };
  },
  shield: (options: object) => ({ rule: "shield", ...options }),
  detectBot: (options: object) => ({ rule: "detectBot", ...options }),
  fixedWindow: (options: object) => ({ rule: "fixedWindow", ...options }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      expect(table).toBe("contact_messages");
      return {
        insert: (row: unknown) => ({
          select: (columns: string) => {
            expect(columns).toBe("id");
            return { single: () => mocks.insert(row) };
          },
        }),
      };
    },
  }),
}));

vi.mock("@/lib/email/queue", () => ({ queueEmailForPermission: mocks.queue }));

const { resetArcjetClients } = await import("@/lib/arcjet");
const { POST } = await import("./route");

const MESSAGE_ID = "323e4567-e89b-42d3-a456-426614174002";

const VALID = {
  name: "Example Visitor",
  email: "visitor@example.com",
  orgType: "organization",
  subject: "A question",
  message: "<b>Hello</b> & welcome",
};

const allow: Decision = { isErrored: () => false, isDenied: () => false, reason: {} };
const rateLimited: Decision = { isErrored: () => false, isDenied: () => true, reason: { isRateLimit: () => true } };
const bot: Decision = { isErrored: () => false, isDenied: () => true, reason: { isRateLimit: () => false } };
const errored: Decision = { isErrored: () => true, isDenied: () => false, reason: { message: "timeout" } };

function post(body: unknown, referer = "https://site.example/ar/contact") {
  return POST(
    new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", referer },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("ARCJET_KEY", "ajkey_test");
  resetArcjetClients();
  mocks.baseOptions.length = 0;
  mocks.routeRules.length = 0;
  mocks.protect.mockReset().mockResolvedValue(allow);
  mocks.insert.mockReset().mockResolvedValue({ data: { id: MESSAGE_ID }, error: null });
  mocks.queue.mockReset().mockResolvedValue(true);
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  logged.mockRestore();
});

describe("POST /api/contact", () => {
  it("saves a valid message as plain text and answers ok", async () => {
    const response = await post(VALID);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.insert).toHaveBeenCalledWith({
      name: "Example Visitor",
      email: "visitor@example.com",
      org_type: "organization",
      subject: "A question",
      message: "<b>Hello</b> & welcome",
    });
  });

  it("runs Shield, bot detection and a per-route, per-IP fixed window, all live", async () => {
    await post(VALID);
    expect(mocks.baseOptions).toEqual([
      {
        key: "ajkey_test",
        rules: [
          { rule: "shield", mode: "LIVE" },
          { rule: "detectBot", mode: "LIVE", allow: [] },
        ],
      },
    ]);
    expect(mocks.routeRules).toEqual([
      { rule: "fixedWindow", mode: "LIVE", characteristics: ["ip.src", "route"], window: "10m", max: 5 },
    ]);
    expect(mocks.protect).toHaveBeenCalledTimes(1);
    expect(mocks.protect.mock.calls[0]?.[1]).toEqual({ route: "contact" });
  });

  it("refuses invalid input with 400 and the error shape, in the page's language", async () => {
    const response = await post({ ...VALID, email: "not-an-email" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "validation_failed", message: "بعض البيانات غير صحيحة. راجعها وحاول مرة أخرى." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses unknown fields, blank text and a body that isn't JSON", async () => {
    for (const body of [{ ...VALID, read_at: "2026-01-01T00:00:00Z" }, { ...VALID, subject: "   " }, "{not json"]) {
      const response = await post(body, "https://site.example/en/contact");
      expect(response.status).toBe(400);
      expect((await response.json()).error.message).toBe("Some details aren't valid. Check them and try again.");
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("answers 429 to a rate-limited request, without saving", async () => {
    mocks.protect.mockResolvedValue(rateLimited);
    const response = await post(VALID, "https://site.example/en/contact");
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: {
        code: "rate_limited",
        message: "You've sent several messages in a short time. Please try again later.",
      },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses a bot or Shield decision with 403, without saving", async () => {
    mocks.protect.mockResolvedValue(bot);
    const response = await post(VALID);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("fails open: an errored decision still saves the message, and is logged", async () => {
    mocks.protect.mockResolvedValue(errored);
    const response = await post(VALID);
    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("[arcjet] contact"), "timeout");
  });

  it("fails open: a thrown error or timeout still saves the message, and is logged", async () => {
    mocks.protect.mockRejectedValue(new Error("network down"));
    const response = await post(VALID);
    expect(response.status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("[arcjet] contact"), expect.any(Error));
  });

  it("fails open without ARCJET_KEY, and logs it", async () => {
    vi.stubEnv("ARCJET_KEY", "");
    resetArcjetClients();
    const response = await post(VALID);
    expect(response.status).toBe(201);
    expect(mocks.protect).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("ARCJET_KEY is not set"));
  });

  it("answers 500 when the insert fails, and never logs the visitor's details", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });
    const response = await post(VALID);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
    expect(mocks.queue).not.toHaveBeenCalled();
    const output = JSON.stringify(logged.mock.calls);
    for (const value of Object.values(VALID)) expect(output).not.toContain(value);
  });

  it("queues one contact_message email for the admins, pointing at the saved row", async () => {
    const response = await post(VALID);
    expect(response.status).toBe(201);
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    // Name and subject only: the text and the address stay in the database.
    expect(mocks.queue).toHaveBeenCalledWith(
      "contact_message",
      "team.manage",
      { name: "Example Visitor", subject: "A question" },
      { entity: "contact_messages", entityId: MESSAGE_ID },
    );
  });

  it("queues nothing for a refused or invalid message", async () => {
    mocks.protect.mockResolvedValue(bot);
    await post(VALID);
    mocks.protect.mockResolvedValue(allow);
    await post({ ...VALID, email: "not-an-email" });
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("still answers ok when the queue fails or throws, without logging the visitor's details", async () => {
    mocks.queue.mockResolvedValue(false);
    const failed = await post(VALID);
    expect(failed.status).toBe(201);
    expect(await failed.json()).toEqual({ ok: true });

    mocks.queue.mockRejectedValue(new Error(`boom ${VALID.email}`));
    const thrown = await post(VALID);
    expect(thrown.status).toBe(201);
    expect(await thrown.json()).toEqual({ ok: true });
    const output = JSON.stringify(logged.mock.calls);
    for (const value of Object.values(VALID)) expect(output).not.toContain(value);
  });
});
