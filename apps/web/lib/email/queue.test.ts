import { PERMISSIONS } from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { queueEmail, queueEmailForPermission } from "./queue";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type Tables = Record<string, Row[]>;

const ADMIN_ROLE = "role-admin";
const EXTRA_ADMIN_ROLE = "role-extra";
const EDITOR_ROLE = "role-editor";
const CONSULTATION = "123e4567-e89b-42d3-a456-426614174000";

const member = (
  email: string,
  role_id: string | null,
  rest: Partial<Row> = {},
): Row => ({
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
  };
}

/**
 * A supabase-js stand-in over in-memory tables. It answers the calls the queue
 * makes: `select().eq().in()` and `insert()`. `fail` makes a table's calls
 * answer with an error, the way PostgREST does.
 */
function fakeService(tables: Tables, fail: Partial<Record<string, DbError>> = {}) {
  return {
    from(table: string) {
      const error = fail[table] ?? null;
      const query = (rows: Row[]) => ({
        eq: (column: string, value: unknown) =>
          query(rows.filter((row) => row[column] === value)),
        in: (column: string, values: unknown[]) =>
          query(rows.filter((row) => values.includes(row[column]))),
        then: (resolve: (result: { data: Row[] | null; error: DbError | null }) => void) =>
          resolve(error ? { data: null, error } : { data: rows, error: null }),
      });
      return {
        select: () => query(tables[table] ?? []),
        insert: async (rows: Row[]) => {
          if (error) return { error };
          tables[table]?.push(...rows);
          return { error: null };
        },
      };
    },
  };
}

let tables: Tables;
let logged: ReturnType<typeof vi.spyOn>;

function useService(fail: Partial<Record<string, DbError>> = {}) {
  vi.mocked(createServiceClient).mockReturnValue(
    fakeService(tables, fail) as unknown as ReturnType<typeof createServiceClient>,
  );
}

const loggedText = () => logged.mock.calls.flat().map(String).join("\n");

beforeEach(() => {
  tables = seed();
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  useService();
});

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(tables.email_outbox).toEqual([
      {
        event: "contact_message",
        to_email: "someone@example.invalid",
        locale: "en",
        payload: { name: "Sender Name", subject: "A question" },
        status: "pending",
      },
    ]);
    expect(logged).not.toHaveBeenCalled();
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
      from: () => ({ insert: () => Promise.reject(new Error("fetch failed")) }),
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
