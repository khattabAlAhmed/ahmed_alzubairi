import { PERMISSIONS } from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { fakeService, type Failures, type Row, type Tables } from "./fake-db";
import { queueEmail, queueEmailForPermission } from "./queue";
import { resetMailerWarning } from "./resend";

const { resendSend, afterMock, background } = vi.hoisted(() => {
  const background: Promise<unknown>[] = [];
  return {
    background,
    resendSend: vi.fn(),
    afterMock: vi.fn((task: () => Promise<unknown>) => {
      background.push(task());
    }),
  };
});

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const ADMIN_ROLE = "role-admin";
const EXTRA_ADMIN_ROLE = "role-extra";
const EDITOR_ROLE = "role-editor";
const CONSULTATION = "123e4567-e89b-42d3-a456-426614174000";

const member = (
  email: string,
  role_id: string | null,
  rest: Partial<Row> = {},
): Row => ({
  clerk_user_id: `user_${email.split("@")[0]}`,
  email,
  role_id,
  locale: "ar",
  timezone: "Asia/Riyadh",
  status: "active",
  notify_optional: true,
  ...rest,
});

function seed(): Tables {
  return {
    role_permissions: [
      { role_id: ADMIN_ROLE, permission: PERMISSIONS.TEAM_MANAGE },
      { role_id: ADMIN_ROLE, permission: PERMISSIONS.TRAINING_MANAGE },
      { role_id: EXTRA_ADMIN_ROLE, permission: PERMISSIONS.TEAM_MANAGE },
      { role_id: EDITOR_ROLE, permission: PERMISSIONS.CONTENT_MANAGE },
    ],
    profiles: [
      member("admin-ar@example.invalid", ADMIN_ROLE),
      member("admin-en@example.invalid", EXTRA_ADMIN_ROLE, {
        locale: "en",
        timezone: "Europe/London",
      }),
      member("quiet-admin@example.invalid", ADMIN_ROLE, {
        notify_optional: false,
      }),
      member("disabled-admin@example.invalid", ADMIN_ROLE, {
        status: "disabled",
      }),
      member("editor@example.invalid", EDITOR_ROLE),
      member("client@example.invalid", null),
    ],
    email_outbox: [],
    notifications: [],
  };
}

let tables: Tables;
let logged: ReturnType<typeof vi.spyOn>;
let warned: ReturnType<typeof vi.spyOn>;

/** Waits for the sends the queue started after the response. */
async function settled() {
  await Promise.all(background.splice(0));
  // A send started without `after` has no handle: let its steps run.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function withKeys() {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "Site <no-reply@example.invalid>");
}

function useService(fail: Failures = {}) {
  vi.mocked(createServiceClient).mockReturnValue(
    fakeService(tables, fail) as unknown as ReturnType<typeof createServiceClient>,
  );
}

const loggedText = () => logged.mock.calls.flat().map(String).join("\n");

beforeEach(() => {
  tables = seed();
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  // No email keys unless a test adds them: rows stay pending.
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  resetMailerWarning();
  resendSend.mockReset().mockResolvedValue({ data: { id: "email_1" }, error: null });
  useService();
});

afterEach(async () => {
  await settled();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  afterMock.mockClear();
  vi.mocked(createServiceClient).mockReset();
});

describe("queueEmail", () => {
  const input = {
    event: "contact_message",
    to: { email: "someone@example.invalid", locale: "en" },
    payload: { name: "Sender Name", subject: "A question" },
  } as const;

  it("writes one pending row", async () => {
    expect(await queueEmail(input)).toBe(true);
    expect(tables.email_outbox).toHaveLength(1);
    expect(tables.email_outbox[0]).toMatchObject({
      event: "contact_message",
      to_email: "someone@example.invalid",
      locale: "en",
      payload: { name: "Sender Name", subject: "A question" },
      status: "pending",
      attempts: 0,
    });
    expect(logged).not.toHaveBeenCalled();
  });

  it("leaves the row pending and warns once when the email keys are missing", async () => {
    expect(await queueEmail(input)).toBe(true);
    expect(await queueEmail(input)).toBe(true);
    await settled();
    expect(resendSend).not.toHaveBeenCalled();
    expect(tables.email_outbox.map((row) => [row.status, row.attempts])).toEqual([
      ["pending", 0],
      ["pending", 0],
    ]);
    expect(warned).toHaveBeenCalledTimes(1);
    expect(String(warned.mock.calls[0]?.[0])).toContain("RESEND_API_KEY");
  });

  it("leaves the row pending when only one key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await queueEmail(input);
    await settled();
    expect(resendSend).not.toHaveBeenCalled();
    expect(tables.email_outbox[0]?.status).toBe("pending");
  });

  it("sends the new row after the response, and marks it sent", async () => {
    withKeys();
    expect(await queueEmail(input)).toBe(true);
    expect(afterMock).toHaveBeenCalledTimes(1);
    await settled();
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(resendSend.mock.calls[0]?.[0]).toMatchObject({
      from: "Site <no-reply@example.invalid>",
      to: "someone@example.invalid",
    });
    expect(tables.email_outbox[0]).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("doesn't make the caller wait for the send", async () => {
    withKeys();
    let finish: (value: unknown) => void = () => {};
    resendSend.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    expect(await queueEmail(input)).toBe(true);
    expect(tables.email_outbox[0]?.status).toBe("pending");
    finish({ data: { id: "email_1" }, error: null });
    await settled();
    expect(tables.email_outbox[0]?.status).toBe("sent");
  });

  it.each([
    ["Resend refuses", () => resendSend.mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded", message: "Too many requests" } })],
    ["Resend can't be reached", () => resendSend.mockRejectedValue(new Error("fetch failed"))],
  ])("still answers true when %s, and keeps the row for the retry", async (_name, arrange) => {
    withKeys();
    arrange();
    await expect(queueEmail(input)).resolves.toBe(true);
    await settled();
    expect(tables.email_outbox[0]).toMatchObject({ status: "failed", attempts: 1 });
  });

  it("sends in the background when there is no request to wait for", async () => {
    withKeys();
    afterMock.mockImplementationOnce(() => {
      throw new Error("`after` was called outside a request scope.");
    });
    await expect(queueEmail(input)).resolves.toBe(true);
    await settled();
    expect(tables.email_outbox[0]?.status).toBe("sent");
  });

  it("stores the payload as its schema reads it, trimmed", async () => {
    await queueEmail({
      ...input,
      payload: { name: "  Sender Name ", subject: "A question" },
    });
    expect(tables.email_outbox[0]?.payload).toEqual({
      name: "Sender Name",
      subject: "A question",
    });
  });

  it.each([
    ["a missing field", { name: "Sender Name" }],
    ["an extra field", { name: "N", subject: "S", message: "the text" }],
    ["another event's payload", { clientName: "N" }],
  ])("refuses %s, and writes nothing", async (_name, payload) => {
    const queued = await queueEmail({ ...input, payload: payload as never });
    expect(queued).toBe(false);
    expect(tables.email_outbox).toEqual([]);
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(loggedText()).toContain("invalid_payload");
  });

  it("returns false when the insert fails, without throwing", async () => {
    useService({ email_outbox: { code: "23514", message: "check failed" } });
    await expect(queueEmail(input)).resolves.toBe(false);
    expect(loggedText()).toContain("contact_message");
    expect(loggedText()).toContain("23514");
  });

  it("returns false when the client can't be created", async () => {
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error("SUPABASE_SECRET_KEY is not set.");
    });
    await expect(queueEmail(input)).resolves.toBe(false);
  });

  it("returns false when the insert rejects", async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        insert: () => ({ select: () => Promise.reject(new Error("fetch failed")) }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>);
    await expect(queueEmail(input)).resolves.toBe(false);
  });

  it("never logs the address, the name or the payload", async () => {
    useService({
      email_outbox: {
        code: "23514",
        message: "Failing row contains (someone@example.invalid, Sender Name)",
      },
    });
    await queueEmail(input);
    await queueEmail({ ...input, payload: { name: "Sender Name" } as never });
    expect(logged).toHaveBeenCalledTimes(2);
    expect(loggedText()).not.toMatch(/someone@|Sender Name|A question/);
  });
});

describe("queueEmailForPermission", () => {
  const payload = { clientName: "Client Name" };
  const recipients = () =>
    tables.email_outbox.map((row) => [row.to_email, row.locale]);

  it("writes a row for every active member whose role holds the permission, in their language", async () => {
    expect(
      await queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload),
    ).toBe(true);
    expect(recipients()).toEqual([
      ["admin-ar@example.invalid", "ar"],
      ["admin-en@example.invalid", "en"],
      ["quiet-admin@example.invalid", "ar"],
    ]);
    for (const row of tables.email_outbox) {
      expect(row).toMatchObject({
        event: "account_new",
        payload,
        status: "pending",
      });
    }
  });

  it("skips disabled members, clients and members without the permission", async () => {
    await queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload);
    const sentTo = recipients().map(([email]) => email);
    expect(sentTo).not.toContain("disabled-admin@example.invalid");
    expect(sentTo).not.toContain("client@example.invalid");
    expect(sentTo).not.toContain("editor@example.invalid");
  });

  it("writes one notification row per recipient, with the event and its entity", async () => {
    await queueEmailForPermission("consultation_new", PERMISSIONS.TEAM_MANAGE, {
      consultationId: CONSULTATION,
      title: "T",
      clientName: "Client Name",
    });
    expect(
      tables.notifications.map(({ user_id, type, entity, entity_id }) => ({
        user_id,
        type,
        entity,
        entity_id,
      })),
    ).toEqual(
      ["user_admin-ar", "user_admin-en", "user_quiet-admin"].map((user_id) => ({
        user_id,
        type: "consultation_new",
        entity: "consultations",
        entity_id: CONSULTATION,
      })),
    );
  });

  it("writes a notification with no entity when the payload names none", async () => {
    await queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload);
    expect(tables.notifications).toHaveLength(3);
    for (const row of tables.notifications) {
      expect(row).toMatchObject({ type: "account_new" });
      expect(row).not.toHaveProperty("entity");
      expect(row).not.toHaveProperty("entity_id");
    }
  });

  it("writes no notification for a member an optional event skips", async () => {
    await queueEmailForPermission("course_registration", PERMISSIONS.TRAINING_MANAGE, {
      courseTitle: { ar: "دورة", en: "Course" },
      traineeName: "Trainee",
    });
    expect(tables.notifications.map((row) => row.user_id)).toEqual(["user_admin-ar"]);
  });

  it("still queues the emails when the notifications can't be written", async () => {
    useService({ notifications: { code: "23503", message: "Key (user_id)=(user_admin-ar)" } });
    await expect(
      queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload),
    ).resolves.toBe(true);
    expect(tables.email_outbox).toHaveLength(3);
    expect(loggedText()).toContain("notifications_23503");
    expect(loggedText()).not.toMatch(/user_admin|@example|Client Name/);
  });

  it("sends every recipient's row after the response", async () => {
    withKeys();
    await queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload);
    await settled();
    expect(resendSend).toHaveBeenCalledTimes(3);
    expect(tables.email_outbox.map((row) => row.status)).toEqual(["sent", "sent", "sent"]);
  });

  it("goes by the permission, not the role", async () => {
    await queueEmailForPermission("account_new", PERMISSIONS.CONTENT_MANAGE, payload);
    expect(recipients()).toEqual([["editor@example.invalid", "ar"]]);
  });

  it("skips an optional event for a member who turned those off", async () => {
    await queueEmailForPermission("course_registration", PERMISSIONS.TRAINING_MANAGE, {
      courseTitle: { ar: "دورة", en: "Course" },
      traineeName: "Trainee",
    });
    expect(recipients()).toEqual([["admin-ar@example.invalid", "ar"]]);
  });

  it("writes a meeting email with each member's own time zone", async () => {
    const meeting = {
      consultationId: CONSULTATION,
      title: "T",
      platform: "Zoom",
      url: "https://example.com/meet",
      startsAt: "2026-11-12T10:00:00.000Z",
      timezone: "America/New_York",
    };
    tables.profiles.push(
      member("odd-zone@example.invalid", ADMIN_ROLE, { timezone: "+03:00" }),
    );
    await queueEmailForPermission("meeting", PERMISSIONS.TEAM_MANAGE, meeting);
    expect(
      tables.email_outbox.map((row) => [
        row.to_email,
        (row.payload as { timezone: string }).timezone,
      ]),
    ).toEqual([
      ["admin-ar@example.invalid", "Asia/Riyadh"],
      ["admin-en@example.invalid", "Europe/London"],
      ["quiet-admin@example.invalid", "Asia/Riyadh"],
      // A stored zone that isn't a zone name keeps the caller's.
      ["odd-zone@example.invalid", "America/New_York"],
    ]);
    expect(tables.email_outbox[0]?.payload).toMatchObject({
      title: "T",
      startsAt: meeting.startsAt,
    });
  });

  it("leaves a payload with no time zone as it is", async () => {
    await queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload);
    expect(tables.email_outbox[0]?.payload).toEqual(payload);
  });

  it("writes nothing, and succeeds, when nobody holds the permission", async () => {
    expect(
      await queueEmailForPermission("account_new", PERMISSIONS.DATA_DELETE, payload),
    ).toBe(true);
    expect(tables.email_outbox).toEqual([]);
  });

  it("refuses a bad payload before reading anything", async () => {
    const queued = await queueEmailForPermission(
      "consultation_new",
      PERMISSIONS.TEAM_MANAGE,
      { consultationId: CONSULTATION, title: "T" } as never,
    );
    expect(queued).toBe(false);
    expect(tables.email_outbox).toEqual([]);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it.each(["role_permissions", "profiles", "email_outbox"])(
    "returns false when %s fails, without throwing",
    async (table) => {
      useService({ [table]: { code: "57014", message: "timeout" } });
      await expect(
        queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload),
      ).resolves.toBe(false);
      expect(tables.email_outbox).toEqual([]);
      expect(tables.notifications).toEqual([]);
      expect(loggedText()).toContain("57014");
      expect(loggedText()).not.toMatch(/@example|Client Name/);
    },
  );

  it("returns false when the client can't be created", async () => {
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error("SUPABASE_SECRET_KEY is not set.");
    });
    await expect(
      queueEmailForPermission("account_new", PERMISSIONS.TEAM_MANAGE, payload),
    ).resolves.toBe(false);
  });
});
