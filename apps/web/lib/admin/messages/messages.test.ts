import {
  PERMISSIONS,
  type MessageListParams,
  type Permission,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import adminEn from "@/messages/en/AdminErrors.json";
import ar from "@/messages/ar/DashboardMessages.json";
import en from "@/messages/en/DashboardMessages.json";
import type { PermissionDeps } from "../permissions";
import { handleMessageRequest, type MessageRouteDeps } from "./route";
import { listMessages, setMessageRead, toMessage } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ID = "323e4567-e89b-42d3-a456-426614174002";

function permission(
  userId: string | null,
  held: Permission[] = [],
): PermissionDeps & { asked: Permission[] } {
  const asked: Permission[] = [];
  return {
    asked,
    getUserId: async () => userId,
    hasPermission: async (key) => {
      asked.push(key);
      return held.includes(key);
    },
  };
}

function patch(body: unknown, deps: MessageRouteDeps, locale = "en") {
  return handleMessageRequest(
    new Request("https://site.example/api/admin/messages", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        referer: `https://site.example/${locale}/dashboard/messages`,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    deps,
  );
}

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => logged.mockRestore());

describe("PATCH /api/admin/messages", () => {
  it("refuses a signed-out caller with 401 and changes nothing", async () => {
    const setRead = vi.fn(async () => true);
    const response = await patch({ id: ID, read: true }, { permission: permission(null), setRead });
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(setRead).not.toHaveBeenCalled();
  });

  it("refuses a member without messages.view with 403 and changes nothing", async () => {
    const setRead = vi.fn(async () => true);
    // Every other permission, to show only this one counts.
    const others = Object.values(PERMISSIONS).filter(
      (key) => key !== PERMISSIONS.MESSAGES_VIEW,
    );
    const deps = permission("user_editor", others);
    const response = await patch({ id: ID, read: true }, { permission: deps, setRead });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "forbidden", message: adminEn.forbidden },
    });
    expect(deps.asked).toEqual([PERMISSIONS.MESSAGES_VIEW]);
    expect(setRead).not.toHaveBeenCalled();
  });

  it("marks a message read, then unread, for a member with messages.view", async () => {
    const setRead = vi.fn(async () => true);
    const deps = { permission: permission("user_admin", [PERMISSIONS.MESSAGES_VIEW]), setRead };
    for (const read of [true, false]) {
      const response = await patch({ id: ID, read }, deps);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    }
    expect(setRead.mock.calls).toEqual([
      [ID, true],
      [ID, false],
    ]);
  });

  it("refuses a bad body with 400: unknown fields, a bad id, a missing flag, not JSON", async () => {
    const setRead = vi.fn(async () => true);
    const deps = { permission: permission("user_admin", [PERMISSIONS.MESSAGES_VIEW]), setRead };
    const bodies = [
      { id: ID, read: true, read_at: "2026-01-01T00:00:00Z" },
      { id: "not-a-uuid", read: true },
      { id: ID },
      { id: ID, read: "yes" },
      "{not json",
    ];
    for (const body of bodies) {
      const response = await patch(body, deps);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("validation_failed");
    }
    expect(setRead).not.toHaveBeenCalled();
  });

  it("answers 404 in the page's language when the message is gone", async () => {
    const deps = (): MessageRouteDeps => ({
      permission: permission("user_admin", [PERMISSIONS.MESSAGES_VIEW]),
      setRead: async () => false,
    });
    const english = await patch({ id: ID, read: true }, deps());
    expect(english.status).toBe(404);
    expect(await english.json()).toEqual({
      error: { code: "not_found", message: en.errors.notFound },
    });
    const arabic = await patch({ id: ID, read: true }, deps(), "ar");
    expect((await arabic.json()).error.message).toBe(ar.errors.notFound);
  });

  it("answers 500 when the write throws", async () => {
    const response = await patch(
      { id: ID, read: true },
      {
        permission: permission("user_admin", [PERMISSIONS.MESSAGES_VIEW]),
        setRead: async () => {
          throw new Error("message update failed: 57014");
        },
      },
    );
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});

/** A fake PostgREST query that records each call and resolves to `result`. */
function fakeClient(result: unknown) {
  const calls: unknown[][] = [];
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  for (const method of ["select", "is", "not", "or", "order", "range", "update", "eq"]) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

const ROW = {
  id: ID,
  name: "Example Visitor",
  email: "visitor@example.com",
  org_type: "company",
  subject: "A question",
  message: "<b>Hello</b>",
  read_at: null,
  created_at: "2026-11-11T10:00:00+00:00",
};

const params = (given: Partial<MessageListParams>): MessageListParams => ({
  page: 1,
  pageSize: 20,
  search: undefined,
  ...given,
});

describe("the messages store", () => {
  it("turns a row into the API shape, with UTC times", () => {
    expect(toMessage({ ...ROW, read_at: "2026-11-11T13:00:00+03:00" })).toEqual({
      id: ID,
      name: "Example Visitor",
      email: "visitor@example.com",
      orgType: "company",
      subject: "A question",
      message: "<b>Hello</b>",
      readAt: "2026-11-11T10:00:00.000Z",
      createdAt: "2026-11-11T10:00:00.000Z",
    });
  });

  it("lists a page newest first, with the total", async () => {
    const { client, calls } = fakeClient({ data: [ROW], error: null, count: 41 });
    const list = await listMessages(client, params({ page: 2 }));
    expect(list.total).toBe(41);
    expect(list.messages).toHaveLength(1);
    expect(calls).toEqual([
      ["from", "contact_messages"],
      ["select", "*", { count: "exact" }],
      ["order", "created_at", { ascending: false }],
      ["order", "id"],
      ["range", 20, 39],
    ]);
  });

  it("filters unread and read, and searches with an escaped pattern", async () => {
    const unread = fakeClient({ data: [], error: null, count: 0 });
    await listMessages(unread.client, params({ page: 1, read: "unread" }));
    expect(unread.calls).toContainEqual(["is", "read_at", null]);

    const read = fakeClient({ data: [], error: null, count: 0 });
    await listMessages(read.client, params({ page: 1, read: "read" }));
    expect(read.calls).toContainEqual(["not", "read_at", "is", null]);

    const search = fakeClient({ data: [], error: null, count: 0 });
    await listMessages(search.client, params({ page: 1, search: 'a,b"%' }));
    const pattern = '"%a,b\\"\\\\%%"';
    expect(search.calls).toContainEqual([
      "or",
      `name.ilike.${pattern},email.ilike.${pattern},subject.ilike.${pattern},message.ilike.${pattern}`,
    ]);
  });

  it("gives an empty page past the last one, with the total from a count", async () => {
    // PostgREST refuses the range and sends no count; the count query answers.
    const results = [
      { data: null, error: { code: "PGRST103" }, count: null },
      { data: null, error: null, count: 3 },
    ];
    const calls: unknown[][] = [];
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => void) => resolve(results.shift()),
    };
    for (const method of ["select", "is", "not", "or", "order", "range"]) {
      query[method] = (...args: unknown[]) => {
        calls.push([method, ...args]);
        return query;
      };
    }
    const client = { from: () => query } as unknown as SupabaseClient<Database>;
    expect(
      await listMessages(client, params({ page: 9, read: "unread" })),
    ).toEqual({ messages: [], total: 3 });
    expect(calls).toContainEqual(["select", "id", { count: "exact", head: true }]);
    // The count uses the same filter as the list.
    expect(calls.filter(([method]) => method === "is")).toHaveLength(2);
  });

  it("throws on any other error", async () => {
    const broken = fakeClient({ data: null, error: { code: "42501" }, count: null });
    await expect(listMessages(broken.client, params({ page: 1 }))).rejects.toThrow(
      "messages list failed: 42501",
    );
  });

  it("sets and clears read_at on one row, and says when the row is missing", async () => {
    const now = new Date("2026-11-11T12:00:00Z");
    const found = fakeClient({ data: [{ id: ID }], error: null });
    expect(await setMessageRead(found.client, ID, true, now)).toBe(true);
    expect(found.calls).toEqual([
      ["from", "contact_messages"],
      ["update", { read_at: "2026-11-11T12:00:00.000Z" }],
      ["eq", "id", ID],
      ["select", "id"],
    ]);

    const missing = fakeClient({ data: [], error: null });
    expect(await setMessageRead(missing.client, ID, false, now)).toBe(false);
    expect(missing.calls).toContainEqual(["update", { read_at: null }]);
  });
});
