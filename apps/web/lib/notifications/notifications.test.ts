import type { Database } from "@repo/db";
import { EMAIL_EVENTS, MAX_NOTIFICATION_IDS } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardNotifications.json";
import en from "@/messages/en/DashboardNotifications.json";
import { notificationTarget, notificationTypeKey } from "./links";
import { handleReadRequest, type ReadRouteDeps } from "./route";
import { countUnread, LATEST_NOTIFICATIONS, listLatest, markRead } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

type Row = {
  id: string;
  user_id: string;
  type: string;
  entity: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};
type Test = (row: Row) => boolean;
type DbError = { code: string };

const ADMIN = "user_admin";
const EDITOR = "user_editor";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function note(n: number, user_id: string, rest: Partial<Row> = {}): Row {
  return {
    id: id(n),
    user_id,
    type: "contact_message",
    entity: "contact_messages",
    entity_id: id(900 + n),
    read_at: null,
    // Later numbers are newer.
    created_at: new Date(Date.UTC(2026, 10, 12, 10, n)).toISOString(),
    ...rest,
  };
}

/**
 * A supabase-js stand-in over in-memory `notifications` rows. It applies the
 * filters it is given and nothing more, like the service client, which RLS
 * doesn't scope. `rls` adds the select policy's filter, like a user's client.
 */
function fakeClient(rows: Row[], { rls, fail }: { rls?: string; fail?: DbError } = {}) {
  const chain = (
    run: (matching: Row[]) => Row[],
    tests: Test[],
    opts: { head?: boolean; limit?: number; sort?: boolean } = {},
  ) => {
    const add = (test: Test) => chain(run, [...tests, test], opts);
    const result = () => {
      if (fail) return { data: null, count: null, error: fail };
      let matching = rows.filter((row) => tests.every((test) => test(row)));
      if (opts.sort) {
        matching = [...matching].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      const data = run(matching).slice(0, opts.limit);
      return { data: opts.head ? null : data, count: data.length, error: null };
    };
    return {
      eq: (column: keyof Row, value: unknown) => add((row) => row[column] === value),
      is: (column: keyof Row, value: null) => add((row) => row[column] === value),
      in: (column: keyof Row, values: unknown[]) => add((row) => values.includes(row[column])),
      order: (column: string) => chain(run, tests, { ...opts, sort: opts.sort || column === "created_at" }),
      limit: (limit: number) => chain(run, tests, { ...opts, limit }),
      then: (resolve: (value: ReturnType<typeof result>) => void) => resolve(result()),
    };
  };
  const policy: Test[] = rls ? [(row) => row.user_id === rls] : [];
  const client = {
    from(table: string) {
      expect(table).toBe("notifications");
      return {
        select: (_columns: string, options?: { head?: boolean }) =>
          chain((matching) => matching, policy, { head: options?.head }),
        update: (patch: Partial<Row>) => {
          // `authenticated` has no update grant on the table.
          if (rls) throw new Error("permission denied for table notifications");
          return chain((matching) => {
            for (const row of matching) Object.assign(row, patch);
            return matching;
          }, []);
        },
      };
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

const unreadOf = (rows: Row[], user: string) =>
  rows.filter((row) => row.user_id === user && row.read_at === null).map((row) => row.id);

function post(body: unknown, deps: ReadRouteDeps, locale = "en") {
  return handleReadRequest(
    new Request("https://site.example/api/notifications/read", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: `https://site.example/${locale}/dashboard/notifications`,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    deps,
  );
}

/** The route's own wiring, over the fake table: the session decides the user. */
function depsFor(rows: Row[], userId: string | null): ReadRouteDeps {
  return {
    getUserId: async () => userId,
    markRead: (user, ids) => markRead(fakeClient(rows), user, ids),
    countUnread: (user) => countUnread(fakeClient(rows, { rls: user }), user),
  };
}

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => logged.mockRestore());

describe("POST /api/notifications/read", () => {
  it("refuses a signed-out caller with 401, in their language, and changes nothing", async () => {
    const rows = [note(1, ADMIN), note(2, EDITOR)];
    const deps = depsFor(rows, null);
    const markSpy = vi.spyOn(deps, "markRead");
    const countSpy = vi.spyOn(deps, "countUnread");
    for (const [locale, messages] of [["en", en], ["ar", ar]] as const) {
      const response = await post({}, deps, locale);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: { code: "unauthenticated", message: messages.errors.unauthenticated },
      });
    }
    expect(markSpy).not.toHaveBeenCalled();
    expect(countSpy).not.toHaveBeenCalled();
    expect(rows.every((row) => row.read_at === null)).toBe(true);
  });

  it("never marks another user's row, even when given its id", async () => {
    const rows = [note(1, ADMIN), note(2, ADMIN), note(3, EDITOR)];
    // The editor names the admin's rows and one of their own.
    const response = await post({ ids: [id(1), id(2), id(3)] }, depsFor(rows, EDITOR));
    expect(response.status).toBe(200);
    // Not an error: the foreign ids are ignored.
    expect(await response.json()).toEqual({ unread: 0 });
    expect(unreadOf(rows, ADMIN)).toEqual([id(1), id(2)]);
    expect(unreadOf(rows, EDITOR)).toEqual([]);
  });

  it("given only someone else's ids, changes nothing and still answers 200", async () => {
    const rows = [note(1, ADMIN), note(2, EDITOR)];
    const response = await post({ ids: [id(1)] }, depsFor(rows, EDITOR));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unread: 1 });
    expect(rows.every((row) => row.read_at === null)).toBe(true);
  });

  it("without ids, marks all of the caller's rows and only those", async () => {
    const rows = [note(1, ADMIN), note(2, EDITOR), note(3, ADMIN), note(4, EDITOR)];
    const response = await post({}, depsFor(rows, ADMIN));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unread: 0 });
    expect(unreadOf(rows, ADMIN)).toEqual([]);
    expect(unreadOf(rows, EDITOR)).toEqual([id(2), id(4)]);
  });

  it("with ids, marks those and leaves the caller's others unread", async () => {
    const rows = [note(1, ADMIN), note(2, ADMIN), note(3, ADMIN)];
    const response = await post({ ids: [id(2)] }, depsFor(rows, ADMIN));
    expect(await response.json()).toEqual({ unread: 2 });
    expect(unreadOf(rows, ADMIN)).toEqual([id(1), id(3)]);
  });

  it("takes the user from the session, never from the body", async () => {
    const rows = [note(1, ADMIN), note(2, EDITOR)];
    for (const body of [{ userId: ADMIN }, { user_id: ADMIN, ids: [id(1)] }]) {
      const response = await post(body, depsFor(rows, EDITOR));
      // The schema is strict: an unknown key is refused.
      expect(response.status).toBe(400);
    }
    expect(rows.every((row) => row.read_at === null)).toBe(true);
  });

  it.each([
    ["not JSON", "nope"],
    ["an empty list", { ids: [] }],
    ["an id that isn't a uuid", { ids: ["1"] }],
    ["too many ids", { ids: Array.from({ length: MAX_NOTIFICATION_IDS + 1 }, (_, n) => id(n)) }],
    ["a list as the body", [id(1)]],
  ])("refuses %s with 400 and changes nothing", async (_name, body) => {
    const rows = [note(1, ADMIN)];
    const response = await post(body, depsFor(rows, ADMIN), "ar");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "validation_failed", message: ar.errors.validation_failed },
    });
    expect(rows[0]?.read_at).toBeNull();
  });

  it("answers 500 without the cause when the database fails", async () => {
    const deps: ReadRouteDeps = {
      getUserId: async () => ADMIN,
      markRead: (user, ids) => markRead(fakeClient([], { fail: { code: "XX000" } }), user, ids),
      countUnread: async () => 0,
    };
    const response = await post({ ids: [id(1)] }, deps);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: en.errors.internal_error },
    });
    // The log has the code, and nothing from the request.
    expect(JSON.stringify(logged.mock.calls)).toContain("XX000");
    expect(JSON.stringify(logged.mock.calls)).not.toContain(id(1));
  });
});

describe("notifications store", () => {
  it("counts the member's unread rows only", async () => {
    const rows = [
      note(1, ADMIN),
      note(2, ADMIN, { read_at: "2026-11-12T11:00:00.000Z" }),
      note(3, EDITOR),
    ];
    expect(await countUnread(fakeClient(rows, { rls: ADMIN }), ADMIN)).toBe(1);
    expect(await countUnread(fakeClient(rows, { rls: EDITOR }), EDITOR)).toBe(1);
    expect(await countUnread(fakeClient([], { rls: ADMIN }), ADMIN)).toBe(0);
  });

  it("lists the member's latest rows, newest first, and no one else's", async () => {
    const rows = Array.from({ length: LATEST_NOTIFICATIONS + 5 }, (_, n) =>
      note(n + 1, n % 5 === 0 ? EDITOR : ADMIN),
    );
    const list = await listLatest(fakeClient(rows, { rls: ADMIN }), ADMIN);
    expect(list).toHaveLength(LATEST_NOTIFICATIONS);
    expect(list[0]?.id).toBe(id(LATEST_NOTIFICATIONS + 5));
    const times = list.map((row) => row.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    const editors = new Set(rows.filter((row) => row.user_id === EDITOR).map((row) => row.id));
    expect(list.some((row) => editors.has(row.id))).toBe(false);
    // The API shape: no user id and no entity id leave the server.
    expect(Object.keys(list[0] ?? {}).sort()).toEqual(
      ["createdAt", "entity", "id", "readAt", "type"].sort(),
    );
  });

  it("keeps the first read time of a row that is already read", async () => {
    const first = "2026-11-12T11:00:00.000Z";
    const rows = [note(1, ADMIN, { read_at: first }), note(2, ADMIN)];
    const now = new Date("2026-11-12T12:00:00.000Z");
    await markRead(fakeClient(rows), ADMIN, undefined, now);
    expect(rows.map((row) => row.read_at)).toEqual([first, now.toISOString()]);
  });

  it("throws the database's code", async () => {
    const broken = fakeClient([], { fail: { code: "XX000" } });
    await expect(countUnread(broken, ADMIN)).rejects.toThrow("XX000");
    await expect(listLatest(broken, ADMIN)).rejects.toThrow("XX000");
    await expect(markRead(broken, ADMIN)).rejects.toThrow("XX000");
  });
});

describe("notification links and labels", () => {
  it("sends a contact message to the Messages section", () => {
    expect(notificationTarget("contact_messages")).toEqual({
      section: "messages",
      href: "/dashboard/messages",
    });
  });

  it("sends anything else to the overview", () => {
    for (const entity of [null, "", "consultations", "constructor", "nope"]) {
      expect(notificationTarget(entity)).toEqual({ section: "overview", href: "/dashboard" });
    }
  });

  it("has a label in both languages for every event, and one for the rest", () => {
    for (const event of EMAIL_EVENTS) {
      expect(notificationTypeKey(event)).toBe(event);
      expect(en.types[event].trim()).not.toBe("");
      expect(ar.types[event].trim()).not.toBe("");
    }
    expect(notificationTypeKey("something_new")).toBe("other");
    expect(notificationTypeKey("")).toBe("other");
  });
});
