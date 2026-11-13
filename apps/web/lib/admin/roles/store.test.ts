/**
 * The route and the real store on a pglite database with every migration
 * applied: Postgres checks the grants, RLS, the unique key and
 * `set_role_permissions`, as it does on the real project.
 */
import { createTestDb, type ApiRole, type TestDb } from "@repo/db/supabase-pglite";
import { PERMISSIONS, type Permission } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../audit";
import { handleRolesRequest, type RoleRouteDeps } from "./route";
import { createRoleStore, ROLE_SELECT } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ADMIN = "user_admin";
const EDITOR = "user_editor";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code: string } | null };

/** The rows PostgREST returns for `ROLE_SELECT`. */
const ROLES_SQL = `
  select r.id, r.key, r.name_ar, r.name_en, r.is_system,
         coalesce(
           (select json_agg(json_build_object('permission', rp.permission))
            from public.role_permissions rp where rp.role_id = r.id),
           '[]'::json
         ) as role_permissions
  from public.roles r`;

let db: TestDb;

function failure(error: unknown): Result {
  return { data: null, error: { code: (error as { code?: string }).code ?? "unknown" } };
}

/**
 * A supabase-js stand-in for the calls the role store makes, run on pglite as
 * `role`. Any other call throws.
 */
function pgliteClient(role: ApiRole, clerkUserId: string | null): SupabaseClient {
  const run = (sql: string, params: unknown[] = []): Promise<Row[]> =>
    db.runAs(role, clerkUserId, async (tx) => (await tx.query<Row>(sql, params)).rows);
  const rows = (query: Promise<Row[]>, pick: (rows: Row[]) => unknown) =>
    query.then((found): Result => ({ data: pick(found), error: null }), failure);

  const client = {
    from(table: string) {
      if (table !== "roles") throw new Error(`stand-in: no table ${table}`);
      return {
        select(columns: string) {
          if (columns !== ROLE_SELECT) throw new Error("stand-in: unknown select");
          return {
            order: () => ({
              order: () =>
                rows(run(`${ROLES_SQL} order by r.is_system desc, r.key`), (found) => found),
            }),
            eq: (_column: "id", value: string) => ({
              maybeSingle: () =>
                rows(run(`${ROLES_SQL} where r.id = $1`, [value]), (found) => found[0] ?? null),
            }),
          };
        },
        insert: (row: { key: string; name_ar: string; name_en: string }) => ({
          select: () => ({
            single: () =>
              rows(
                run(
                  `insert into public.roles (key, name_ar, name_en)
                   values ($1, $2, $3) returning id`,
                  [row.key, row.name_ar, row.name_en],
                ),
                (found) => found[0],
              ),
          }),
        }),
        delete: () => ({
          eq: (_column: "id", value: string) =>
            rows(run("delete from public.roles where id = $1", [value]), () => null),
        }),
      };
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name !== "set_role_permissions") throw new Error(`stand-in: no rpc ${name}`);
      return rows(
        run(
          `select public.set_role_permissions(
             role_id => $1, name_ar => $2, name_en => $3, permissions => $4
           ) as result`,
          [args.role_id, args.name_ar ?? null, args.name_en ?? null, args.permissions ?? null],
        ),
        (found) => found[0]?.result,
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

async function roleId(key: string): Promise<string> {
  const { rows: found } = await db.owner.query<{ id: string }>(
    "select id from public.roles where key = $1",
    [key],
  );
  return found[0].id;
}

async function permissionsOf(key: string): Promise<string[]> {
  const { rows: found } = await db.owner.query<{ permission: string }>(
    `select rp.permission from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
     where r.key = $1 order by rp.permission`,
    [key],
  );
  return found.map((row) => row.permission);
}

async function addMember(clerkUserId: string, roleKey: string) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, role_id)
     values ($1, 'Test', $1 || '@example.invalid', '+10000000000', 'UTC', now(), 'active',
       (select id from public.roles where key = $2))`,
    [clerkUserId, roleKey],
  );
}

/** The route as `userId`: the session is faked, the database decides the rest. */
function send(userId: string | null, method: string, body?: unknown) {
  const audit = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {});
  const deps: RoleRouteDeps = {
    permission: {
      getUserId: async () => userId,
      hasPermission: (key) => hasPermission(userId ?? "", key),
    },
    createStore: () =>
      createRoleStore(
        pgliteClient("authenticated", userId),
        pgliteClient("service_role", null),
      ),
    audit,
  };
  const request = new Request("https://site.example/api/admin/roles", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleRolesRequest(request, deps).then((response) => ({ response, audit }));
}

beforeAll(async () => {
  db = await createTestDb();
  await addMember(ADMIN, "admin");
  await addMember(EDITOR, "content_editor");
  vi.spyOn(console, "error").mockImplementation(() => {});
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("/api/admin/roles on the database", () => {
  it("GET lists the seeded roles with their permissions, system roles by key", async () => {
    const { response } = await send(ADMIN, "GET");
    expect(response.status).toBe(200);
    const { roles } = await response.json();
    expect(roles.map((role: { key: string }) => role.key)).toEqual([
      "admin",
      "assistant_consultant",
      "content_editor",
      "training_coordinator",
    ]);
    expect(roles[0].permissions).toEqual(Object.values(PERMISSIONS).sort());
    expect(roles[2]).toMatchObject({
      isSystem: true,
      nameEn: "Content Editor",
      permissions: ["content.manage", "document_requests.recommend", "documents.view"],
    });
  });

  it("a member without team.manage is refused by the database's own check", async () => {
    const { response } = await send(EDITOR, "PATCH", {
      id: await roleId("content_editor"),
      permissions: Object.values(PERMISSIONS),
    });
    expect(response.status).toBe(403);
    expect(await hasPermission(EDITOR, PERMISSIONS.TEAM_MANAGE)).toBe(false);
  });

  it("PATCH takes content.manage from a member at once, and gives it back at once", async () => {
    const id = await roleId("content_editor");
    expect(await hasPermission(EDITOR, PERMISSIONS.CONTENT_MANAGE)).toBe(true);

    const removed = await send(ADMIN, "PATCH", {
      id,
      permissions: [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND, PERMISSIONS.DOCUMENTS_VIEW],
    });
    expect(removed.response.status).toBe(200);
    expect(await hasPermission(EDITOR, PERMISSIONS.CONTENT_MANAGE)).toBe(false);
    expect(await hasPermission(EDITOR, PERMISSIONS.DOCUMENTS_VIEW)).toBe(true);
    expect(removed.audit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        actorId: ADMIN,
        action: "role.update",
        entityId: id,
        metadata: {
          from: ["content.manage", "document_requests.recommend", "documents.view"],
          to: ["document_requests.recommend", "documents.view"],
          renamed: false,
        },
      }),
    );

    const restored = await send(ADMIN, "PATCH", {
      id,
      permissions: [
        PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
        PERMISSIONS.DOCUMENTS_VIEW,
        PERMISSIONS.CONTENT_MANAGE,
      ],
    });
    expect(restored.response.status).toBe(200);
    expect(await hasPermission(EDITOR, PERMISSIONS.CONTENT_MANAGE)).toBe(true);
  });

  it("PATCH adds and removes in one edit", async () => {
    const id = await roleId("training_coordinator");
    const { response } = await send(ADMIN, "PATCH", {
      id,
      nameEn: "Trainer",
      permissions: [PERMISSIONS.TRAINING_MANAGE, PERMISSIONS.MESSAGES_VIEW],
    });
    expect(response.status).toBe(200);
    expect(await permissionsOf("training_coordinator")).toEqual([
      "messages.view",
      "training.manage",
    ]);
  });

  it("PATCH on the admin role is 403 and the role keeps every permission", async () => {
    const { response, audit } = await send(ADMIN, "PATCH", {
      id: await roleId("admin"),
      permissions: [PERMISSIONS.TEAM_MANAGE],
    });
    expect(response.status).toBe(403);
    expect(await permissionsOf("admin")).toHaveLength(Object.values(PERMISSIONS).length);
    expect(audit).not.toHaveBeenCalled();
  });

  it("PATCH on an unknown role is 404", async () => {
    const { response } = await send(ADMIN, "PATCH", {
      id: "123e4567-e89b-42d3-a456-426614174199",
      permissions: [],
    });
    expect(response.status).toBe(404);
  });

  it("POST creates a role that isn't a system role, with its permissions", async () => {
    const { response, audit } = await send(ADMIN, "POST", {
      key: "media_officer",
      nameAr: "مسؤول إعلام",
      nameEn: "Media Officer",
      permissions: [PERMISSIONS.MESSAGES_VIEW, PERMISSIONS.CONTENT_MANAGE],
    });
    expect(response.status).toBe(200);
    expect(await permissionsOf("media_officer")).toEqual(["content.manage", "messages.view"]);
    const { rows: found } = await db.owner.query(
      "select is_system, name_en from public.roles where key = 'media_officer'",
    );
    expect(found).toEqual([{ is_system: false, name_en: "Media Officer" }]);
    expect(audit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        action: "role.create",
        entityId: await roleId("media_officer"),
      }),
    );
  });

  it.each(["media_officer", "admin"])(
    "POST with the key %s, which a role has, is 409 and changes nothing",
    async (key) => {
      const before = await permissionsOf(key);
      const { response, audit } = await send(ADMIN, "POST", {
        key,
        nameAr: "آخر",
        nameEn: "Other",
        permissions: [PERMISSIONS.DATA_DELETE],
      });
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("conflict");
      expect(await permissionsOf(key)).toEqual(before);
      expect(audit).not.toHaveBeenCalled();
    },
  );
});
