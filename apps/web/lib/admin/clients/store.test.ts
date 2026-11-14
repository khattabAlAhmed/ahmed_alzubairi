/**
 * The route and the real store on a pglite database with every migration
 * applied: Postgres checks the grants, RLS, the scoped rule of §5 and
 * `disable_client`, as it does on the real project. Only Clerk is faked.
 */
import { createTestDb, type ApiRole, type TestDb } from "@repo/db/supabase-pglite";
import { PERMISSIONS, type Permission } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../audit";
import type { ClerkBan } from "./clerk-ban";
import { handleClientsRequest, type ClientRouteDeps } from "./route";
import { createClientStore } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ADMIN = "user_admin";
const ASSISTANT = "user_assistant";
const OTHER_ASSISTANT = "user_assistant_2";
const FORMER_ASSISTANT = "user_assistant_former";
const EDITOR = "user_editor";
const TRAINER = "user_trainer";
/** Has a consultation assigned to ASSISTANT. */
const CLIENT_A = "user_client_a";
/** Registered in a course. */
const CLIENT_B = "user_client_b";
/** Has a consultation assigned to nobody. */
const CLIENT_C = "user_client_c";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code: string } | null; count?: number };

let db: TestDb;

/**
 * A supabase-js stand-in for the calls the client store makes, run on pglite
 * as `role`. It turns the filters into SQL; any other call throws. Column
 * names come from the store's own code, never from a request.
 */
function pgliteClient(role: ApiRole, clerkUserId: string | null): SupabaseClient {
  const run = (sql: string, params: unknown[] = []): Promise<Row[]> =>
    db.runAs(role, clerkUserId, async (tx) => (await tx.query<Row>(sql, params)).rows);

  function profiles() {
    const where: string[] = [];
    const params: unknown[] = [];
    const orders: string[] = [];
    let columns = "*";
    let counted = false;
    let update: Row | null = null;
    let range: [number, number] | null = null;

    const whereSql = () => (where.length ? `where ${where.join(" and ")}` : "");

    async function rows(): Promise<{ found: Row[]; count: number }> {
      if (update) {
        const sets = Object.keys(update).map((column, index) => {
          return `${column} = $${params.length + index + 1}`;
        });
        const found = await run(
          `update public.profiles set ${sets.join()} ${whereSql()} returning ${columns}`,
          [...params, ...Object.values(update)],
        );
        return { found, count: found.length };
      }
      const page = range ? `offset ${range[0]} limit ${range[1] - range[0] + 1}` : "";
      const order = orders.length ? `order by ${orders.join()}` : "";
      const found = await run(
        `select ${columns} from public.profiles ${whereSql()} ${order} ${page}`,
        params,
      );
      if (!counted) return { found, count: found.length };
      const total = await run(
        `select count(*)::int as total from public.profiles ${whereSql()}`,
        params,
      );
      return { found, count: Number(total[0]?.total) };
    }

    const failure = (error: unknown): Result => ({
      data: null,
      error: { code: (error as { code?: string }).code ?? "unknown" },
    });

    const query = {
      select(list: string, options?: { count: "exact" }) {
        columns = list;
        counted = options?.count === "exact";
        return query;
      },
      update(values: Row) {
        update = values;
        return query;
      },
      eq(column: string, value: unknown) {
        params.push(value);
        where.push(`${column} = $${params.length}`);
        return query;
      },
      is(column: string, value: null) {
        if (value !== null) throw new Error("stand-in: is() takes null only");
        where.push(`${column} is null`);
        return query;
      },
      or() {
        throw new Error("stand-in: search isn't covered here");
      },
      order(column: string, options?: { ascending: boolean }) {
        orders.push(`${column} ${options?.ascending === false ? "desc" : "asc"}`);
        return query;
      },
      range(from: number, to: number) {
        range = [from, to];
        return query;
      },
      maybeSingle: () =>
        rows().then(
          ({ found }): Result => ({ data: found[0] ?? null, error: null }),
          failure,
        ),
      then: (resolve: (value: Result) => unknown) =>
        rows()
          .then(
            ({ found, count }): Result => ({ data: found, error: null, count }),
            failure,
          )
          .then(resolve),
    };
    return query;
  }

  const client = {
    from(table: string) {
      if (table !== "profiles") throw new Error(`stand-in: no table ${table}`);
      return profiles();
    },
    rpc(name: string, args: { client_id: string }) {
      if (name !== "disable_client") throw new Error(`stand-in: no rpc ${name}`);
      return run("select public.disable_client($1) as closed", [args.client_id]).then(
        (found): Result => ({ data: found[0]?.closed ?? null, error: null }),
        (error): Result => ({ data: null, error: { code: error.code ?? "unknown" } }),
      );
    },
  };
  return client as unknown as SupabaseClient;
}

async function hasPermission(clerkUserId: string, key: Permission): Promise<boolean> {
  const found = await db.runAs("authenticated", clerkUserId, async (tx) =>
    tx.query<{ allowed: boolean }>("select public.has_permission($1) as allowed", [key]),
  );
  return found.rows[0]?.allowed === true;
}

async function addProfile(
  clerkUserId: string,
  roleKey: string | null,
  createdAt: string,
  status = "active",
) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at,
        status, created_at, role_id)
     values ($1, 'Test', $1 || '@example.com', '+10000000000', 'UTC', now(), $3, $4,
       (select id from public.roles where key = $2))`,
    [clerkUserId, roleKey, status, createdAt],
  );
}

async function addConsultation(clientId: string, assignedTo: string | null) {
  await db.owner.query(
    `insert into public.consultations (client_id, title, description, assigned_to)
     values ($1, 'Test', 'Test', $2)`,
    [clientId, assignedTo],
  );
}

async function statusOf(clerkUserId: string) {
  const { rows } = await db.owner.query<{ status: string }>(
    "select status from public.profiles where clerk_user_id = $1",
    [clerkUserId],
  );
  return rows[0]?.status;
}

async function consultationStatuses(clientId: string) {
  const { rows } = await db.owner.query<{ status: string }>(
    "select status from public.consultations where client_id = $1 order by status",
    [clientId],
  );
  return rows.map((row) => row.status);
}

/** The route as `userId`: the session and Clerk are faked, the database decides the rest. */
function send(
  userId: string | null,
  method: "GET" | "PATCH",
  { body, query = "", banFails = false }: { body?: unknown; query?: string; banFails?: boolean } = {},
) {
  const audit = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {});
  const clerk = {
    ban: vi.fn(async () => {
      if (banFails) throw new Error("Clerk is down");
    }),
    unban: vi.fn(async () => {}),
    isBanned: vi.fn(async () => false),
  } satisfies ClerkBan;
  const deps: ClientRouteDeps = {
    getUserId: async () => userId,
    permission: {
      getUserId: async () => userId,
      hasPermission: (key) => hasPermission(userId ?? "", key),
    },
    createStore: () =>
      createClientStore(
        pgliteClient("authenticated", userId),
        pgliteClient("service_role", null),
      ),
    createClerk: () => clerk,
    audit,
  };
  const request = new Request(`https://site.example/api/admin/clients${query}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleClientsRequest(request, deps).then((response) => ({ response, audit, clerk }));
}

async function clientIds(userId: string, query = "") {
  const { response } = await send(userId, "GET", { query });
  expect(response.status).toBe(200);
  const body: { clients: { id: string }[]; total: number } = await response.json();
  return { ids: body.clients.map((client) => client.id), total: body.total };
}

beforeAll(async () => {
  db = await createTestDb();
  await addProfile(ADMIN, "admin", "2026-01-01T00:00:00Z");
  await addProfile(ASSISTANT, "assistant_consultant", "2026-01-02T00:00:00Z");
  await addProfile(OTHER_ASSISTANT, "assistant_consultant", "2026-01-03T00:00:00Z");
  await addProfile(FORMER_ASSISTANT, "assistant_consultant", "2026-01-04T00:00:00Z", "disabled");
  await addProfile(EDITOR, "content_editor", "2026-01-05T00:00:00Z");
  await addProfile(TRAINER, "training_coordinator", "2026-01-06T00:00:00Z");
  await addProfile(CLIENT_A, null, "2026-02-01T00:00:00Z");
  await addProfile(CLIENT_B, null, "2026-02-02T00:00:00Z");
  await addProfile(CLIENT_C, null, "2026-02-03T00:00:00Z");

  await addConsultation(CLIENT_A, ASSISTANT);
  await addConsultation(CLIENT_A, null);
  await addConsultation(CLIENT_C, null);
  // A disabled member keeps no scoped access to the clients assigned to them.
  await addConsultation(CLIENT_C, FORMER_ASSISTANT);
  await db.owner.query(
    `with course as (
       insert into public.courses (slug, type) values ('test-course', 'online_live')
       returning id
     )
     insert into public.course_registrations (course_id, client_id)
     select id, $1 from course`,
    [CLIENT_B],
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("GET /api/admin/clients on the database", () => {
  it("the admin sees every client, newest first, and no team member", async () => {
    expect(await clientIds(ADMIN)).toEqual({
      ids: [CLIENT_C, CLIENT_B, CLIENT_A],
      total: 3,
    });
  });

  it("an assistant consultant sees only clients of consultations assigned to them", async () => {
    expect(await clientIds(ASSISTANT)).toEqual({ ids: [CLIENT_A], total: 1 });
    expect(await clientIds(OTHER_ASSISTANT)).toEqual({ ids: [], total: 0 });
  });

  it("a training coordinator sees only clients with a course registration", async () => {
    expect(await clientIds(TRAINER)).toEqual({ ids: [CLIENT_B], total: 1 });
  });

  it("a content editor sees none", async () => {
    expect(await clientIds(EDITOR)).toEqual({ ids: [], total: 0 });
  });

  it("pages and filters by status in the database", async () => {
    expect(await clientIds(ADMIN, "?page=2&pageSize=2")).toEqual({
      ids: [CLIENT_A],
      total: 3,
    });
    expect(await clientIds(ADMIN, "?status=disabled")).toEqual({ ids: [], total: 0 });
  });

  it.each([
    ["a client", CLIENT_A],
    ["a disabled team member", FORMER_ASSISTANT],
    ["a signed-in user with no profile", "user_new"],
  ])("refuses %s with 403", async (_name, userId) => {
    const { response } = await send(userId, "GET");
    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/admin/clients on the database", () => {
  it("refuses a member who sees the client through the scoped rule", async () => {
    expect((await clientIds(ASSISTANT)).ids).toContain(CLIENT_A);
    const { response, clerk, audit } = await send(ASSISTANT, "PATCH", {
      body: { id: CLIENT_A, status: "disabled" },
    });
    expect(response.status).toBe(403);
    expect(await hasPermission(ASSISTANT, PERMISSIONS.CLIENTS_VIEW_ALL)).toBe(false);
    expect(await statusOf(CLIENT_A)).toBe("active");
    expect(clerk.ban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses a team member's id, and leaves the member active", async () => {
    const { response, clerk } = await send(ADMIN, "PATCH", {
      body: { id: EDITOR, status: "disabled" },
    });
    expect(response.status).toBe(403);
    expect(await statusOf(EDITOR)).toBe("active");
    expect(clerk.ban).not.toHaveBeenCalled();
  });

  it("a failed ban leaves the client active", async () => {
    const { response, audit } = await send(ADMIN, "PATCH", {
      body: { id: CLIENT_B, status: "disabled" },
      banFails: true,
    });
    expect(response.status).toBe(502);
    expect(await statusOf(CLIENT_B)).toBe("active");
    expect(audit).not.toHaveBeenCalled();
  });

  it("disables a client and closes their open consultations, then reactivates them", async () => {
    const disabled = await send(ADMIN, "PATCH", {
      body: { id: CLIENT_A, status: "disabled" },
    });
    expect(disabled.response.status).toBe(200);
    expect(await statusOf(CLIENT_A)).toBe("disabled");
    expect(await consultationStatuses(CLIENT_A)).toEqual(["closed", "closed"]);
    expect(disabled.clerk.ban).toHaveBeenCalledExactlyOnceWith(CLIENT_A);
    expect(disabled.audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "client.disable",
      entity: "profiles",
      entityId: CLIENT_A,
      metadata: { closedConsultations: 2 },
    });
    expect(await clientIds(ADMIN, "?status=disabled")).toEqual({
      ids: [CLIENT_A],
      total: 1,
    });

    const enabled = await send(ADMIN, "PATCH", {
      body: { id: CLIENT_A, status: "active" },
    });
    expect(enabled.response.status).toBe(200);
    expect(await statusOf(CLIENT_A)).toBe("active");
    // Closed consultations stay closed.
    expect(await consultationStatuses(CLIENT_A)).toEqual(["closed", "closed"]);
    expect(enabled.clerk.unban).toHaveBeenCalledExactlyOnceWith(CLIENT_A);
    expect(enabled.audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "client.enable",
      entity: "profiles",
      entityId: CLIENT_A,
    });
  });
});
