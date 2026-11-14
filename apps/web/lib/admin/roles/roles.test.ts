import {
  PERMISSIONS,
  type AdminRole,
  type CreateRoleRequest,
  type Permission,
} from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import adminAr from "@/messages/ar/AdminErrors.json";
import adminEn from "@/messages/en/AdminErrors.json";
import type { AuditEntry } from "../audit";
import type { PermissionDeps } from "../permissions";
import {
  createRole,
  listRoles,
  updateRole,
  type RoleChanges,
  type RoleDeps,
  type RoleStore,
} from "./handlers";
import { handleRolesRequest, type RoleRouteDeps } from "./route";
import { createRoleStore } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ADMIN = "user_admin";
const MEMBER = "user_member";

const ADMIN_ROLE = "22222222-2222-4222-8222-222222222222";
const EDITOR_ROLE = "11111111-1111-4111-8111-111111111111";
const UNKNOWN_ROLE = "33333333-3333-4333-8333-333333333333";
const NEW_ROLE = "55555555-5555-4555-8555-555555555555";

const EDITOR_PERMISSIONS: Permission[] = [
  PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
  PERMISSIONS.DOCUMENTS_VIEW,
  PERMISSIONS.CONTENT_MANAGE,
];

const NEW_ROLE_BODY = {
  key: "media_officer",
  nameAr: "مسؤول إعلام",
  nameEn: "Media Officer",
  permissions: [PERMISSIONS.MESSAGES_VIEW, PERMISSIONS.CONTENT_MANAGE],
};

function world() {
  const roles = new Map<string, AdminRole>([
    [
      ADMIN_ROLE,
      {
        id: ADMIN_ROLE,
        key: "admin",
        nameAr: "المدير",
        nameEn: "Admin",
        isSystem: true,
        permissions: Object.values(PERMISSIONS),
      },
    ],
    [
      EDITOR_ROLE,
      {
        id: EDITOR_ROLE,
        key: "content_editor",
        nameAr: "محرر محتوى",
        nameEn: "Content Editor",
        isSystem: true,
        permissions: [...EDITOR_PERMISSIONS],
      },
    ],
  ]);

  const store = {
    listRoles: vi.fn(async () => [...roles.values()]),
    getRole: vi.fn(async (id: string) => {
      const role = roles.get(id);
      return role ? { ...role, permissions: [...role.permissions] } : null;
    }),
    createRole: vi.fn(
      async (
        input: CreateRoleRequest,
      ): Promise<Awaited<ReturnType<RoleStore["createRole"]>>> => {
        if ([...roles.values()].some((role) => role.key === input.key)) {
          return { ok: false, reason: "key_taken" };
        }
        roles.set(NEW_ROLE, { id: NEW_ROLE, isSystem: false, ...input });
        return { ok: true, id: NEW_ROLE };
      },
    ),
    // Like the real write: never the admin role, never a missing role.
    updateRole: vi.fn(async (id: string, changes: RoleChanges) => {
      const role = roles.get(id);
      if (!role || role.key === "admin") return false;
      Object.assign(role, changes);
      return true;
    }),
  } satisfies RoleStore;

  const audit = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {});
  const deps = { locale: "en", userId: ADMIN, store, audit } satisfies RoleDeps;
  return { roles, store, audit, deps };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listRoles", () => {
  it("returns every role with its permissions", async () => {
    const { deps } = world();
    const result = await listRoles(deps);
    expect(result.status).toBe(200);
    expect(result.body.roles.map((role) => role.key)).toEqual([
      "admin",
      "content_editor",
    ]);
    expect(result.body.roles[1].permissions).toEqual(EDITOR_PERMISSIONS);
  });
});

describe("createRole", () => {
  it("creates the role and audits its key and permissions", async () => {
    const { deps, roles, audit } = world();
    const result = await createRole(NEW_ROLE_BODY, deps);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(roles.get(NEW_ROLE)).toMatchObject({
      key: "media_officer",
      isSystem: false,
      permissions: NEW_ROLE_BODY.permissions,
    });
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "role.create",
      entity: "roles",
      entityId: NEW_ROLE,
      metadata: {
        key: "media_officer",
        from: [],
        to: [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.MESSAGES_VIEW],
      },
    });
  });

  it("a role may start with no permissions", async () => {
    const { deps } = world();
    const result = await createRole({ ...NEW_ROLE_BODY, permissions: [] }, deps);
    expect(result.status).toBe(200);
  });

  it.each(["content_editor", "admin"])(
    "answers 409 for the key %s, which a role already has, and audits nothing",
    async (key) => {
      const { deps, roles, audit } = world();
      const result = await createRole({ ...NEW_ROLE_BODY, key }, deps);
      expect(result).toEqual({
        status: 409,
        body: { error: { code: "conflict", message: adminEn.roleKeyTaken } },
      });
      expect(roles.size).toBe(2);
      expect(audit).not.toHaveBeenCalled();
    },
  );

  it("answers in Arabic for an Arabic caller", async () => {
    const { deps } = world();
    const result = await createRole(
      { ...NEW_ROLE_BODY, key: "content_editor" },
      { ...deps, locale: "ar" },
    );
    expect(result.body).toEqual({
      error: { code: "conflict", message: adminAr.roleKeyTaken },
    });
  });

  it.each([
    ["an unknown permission key", { permissions: ["site.destroy"] }],
    ["a role name in place of a permission", { permissions: ["admin"] }],
    ["a permission listed twice", {
      permissions: [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.CONTENT_MANAGE],
    }],
    ["a key with capitals", { key: "Media" }],
    ["a key with a space", { key: "media officer" }],
    ["an empty name", { nameEn: "" }],
    ["an extra field", { isSystem: true }],
  ])("answers 400 for %s and writes nothing", async (_label, patch) => {
    const { deps, store, audit } = world();
    const result = await createRole({ ...NEW_ROLE_BODY, ...patch }, deps);
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { code: "validation_failed" } });
    expect(store.createRole).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

describe("updateRole", () => {
  it("replaces the permission set and audits the old and new lists", async () => {
    const { deps, roles, store, audit } = world();
    const next = [PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.MESSAGES_VIEW];
    const result = await updateRole({ id: EDITOR_ROLE, permissions: next }, deps);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(store.updateRole).toHaveBeenCalledExactlyOnceWith(EDITOR_ROLE, {
      permissions: next,
    });
    expect(roles.get(EDITOR_ROLE)?.permissions).toEqual(next);
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "role.update",
      entity: "roles",
      entityId: EDITOR_ROLE,
      metadata: {
        from: [...EDITOR_PERMISSIONS].sort(),
        to: [...next].sort(),
        renamed: false,
      },
    });
  });

  it("renames a role, leaving its permissions and its key alone", async () => {
    const { deps, roles, store, audit } = world();
    const result = await updateRole(
      { id: EDITOR_ROLE, nameEn: "Editor", nameAr: "محرر" },
      deps,
    );
    expect(result.status).toBe(200);
    expect(store.updateRole).toHaveBeenCalledWith(EDITOR_ROLE, {
      nameEn: "Editor",
      nameAr: "محرر",
    });
    expect(roles.get(EDITOR_ROLE)).toMatchObject({
      key: "content_editor",
      nameEn: "Editor",
      permissions: EDITOR_PERMISSIONS,
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ renamed: true }),
      }),
    );
    // Names stay out of the log.
    expect(JSON.stringify(audit.mock.calls)).not.toContain("Editor");
  });

  it("a role may lose every permission", async () => {
    const { deps, roles } = world();
    const result = await updateRole({ id: EDITOR_ROLE, permissions: [] }, deps);
    expect(result.status).toBe(200);
    expect(roles.get(EDITOR_ROLE)?.permissions).toEqual([]);
  });

  it.each([
    ["its permissions", { permissions: [PERMISSIONS.TEAM_MANAGE] }],
    ["every permission", { permissions: [] }],
    ["the same permissions", { permissions: Object.values(PERMISSIONS) }],
    ["its name", { nameEn: "Owner" }],
  ])("refuses to change the admin role's %s: 403 and no write", async (_label, patch) => {
    const { deps, roles, store, audit } = world();
    const result = await updateRole({ id: ADMIN_ROLE, ...patch }, deps);
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: adminEn.roleAdminLocked } },
    });
    expect(store.updateRole).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    expect(roles.get(ADMIN_ROLE)).toMatchObject({
      nameEn: "Admin",
      permissions: Object.values(PERMISSIONS),
    });
  });

  it("answers 404 for a role that doesn't exist", async () => {
    const { deps, store } = world();
    const result = await updateRole({ id: UNKNOWN_ROLE, nameEn: "Ghost" }, deps);
    expect(result.status).toBe(404);
    expect(store.updateRole).not.toHaveBeenCalled();
  });

  it("answers 404 and audits nothing when the write finds no role", async () => {
    const { deps, store, audit } = world();
    store.updateRole.mockResolvedValue(false);
    const result = await updateRole({ id: EDITOR_ROLE, permissions: [] }, deps);
    expect(result.status).toBe(404);
    expect(audit).not.toHaveBeenCalled();
  });

  it("values that are already set change nothing and audit nothing", async () => {
    const { deps, store, audit } = world();
    const result = await updateRole(
      {
        id: EDITOR_ROLE,
        nameEn: "Content Editor",
        permissions: [...EDITOR_PERMISSIONS].reverse(),
      },
      deps,
    );
    expect(result.status).toBe(200);
    expect(store.updateRole).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown permission key", { id: EDITOR_ROLE, permissions: ["site.destroy"] }],
    ["a permission listed twice", {
      id: EDITOR_ROLE,
      permissions: [PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.DOCUMENTS_VIEW],
    }],
    ["a new key", { id: EDITOR_ROLE, key: "editor" }],
    ["the system flag", { id: EDITOR_ROLE, isSystem: false }],
    ["no field besides the id", { id: EDITOR_ROLE }],
    ["an id that isn't a uuid", { id: "content_editor", nameEn: "Editor" }],
    ["no body", undefined],
  ])("answers 400 for %s and reads nothing", async (_label, body) => {
    const { deps, store, audit } = world();
    const result = await updateRole(body, deps);
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { code: "validation_failed" } });
    expect(store.getRole).not.toHaveBeenCalled();
    expect(store.updateRole).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

function routeDeps(userId: string | null, held: Permission[]) {
  const w = world();
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => held.includes(key),
  };
  const deps = {
    permission,
    createStore: vi.fn(() => w.store),
    audit: w.audit,
  } satisfies RoleRouteDeps;
  return { deps, w };
}

function request(method: string, body?: unknown): Request {
  return new Request("https://site.example/api/admin/roles", {
    method,
    headers: {
      "content-type": "application/json",
      referer: "https://site.example/en/dashboard/team",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const REQUESTS = [
  ["GET", undefined],
  ["POST", NEW_ROLE_BODY],
  ["PATCH", { id: EDITOR_ROLE, permissions: [] }],
] as const;

describe("/api/admin/roles", () => {
  it.each(REQUESTS)("%s signed out is 401, and nothing is read", async (method, body) => {
    const { deps, w } = routeDeps(null, []);
    const response = await handleRolesRequest(request(method, body), deps);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(deps.createStore).not.toHaveBeenCalled();
    expect(w.audit).not.toHaveBeenCalled();
  });

  it.each(REQUESTS)(
    "%s without team.manage is 403, whatever else the member holds",
    async (method, body) => {
      const others = Object.values(PERMISSIONS).filter(
        (key) => key !== PERMISSIONS.TEAM_MANAGE,
      );
      const { deps, w } = routeDeps(MEMBER, others);
      const response = await handleRolesRequest(request(method, body), deps);
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("forbidden");
      expect(deps.createStore).not.toHaveBeenCalled();
      expect(w.store.updateRole).not.toHaveBeenCalled();
      expect(w.audit).not.toHaveBeenCalled();
    },
  );

  it("GET with team.manage lists the roles", async () => {
    const { deps } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleRolesRequest(request("GET"), deps);
    expect(response.status).toBe(200);
    expect((await response.json()).roles).toHaveLength(2);
  });

  it("POST with team.manage creates the role as the session's user", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleRolesRequest(request("POST", NEW_ROLE_BODY), deps);
    expect(response.status).toBe(200);
    expect(w.audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ADMIN, action: "role.create" }),
    );
  });

  it("POST with a key that is taken is 409", async () => {
    const { deps } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleRolesRequest(
      request("POST", { ...NEW_ROLE_BODY, key: "content_editor" }),
      deps,
    );
    expect(response.status).toBe(409);
  });

  it("POST with an unknown permission key is 400", async () => {
    const { deps } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleRolesRequest(
      request("POST", { ...NEW_ROLE_BODY, permissions: ["site.destroy"] }),
      deps,
    );
    expect(response.status).toBe(400);
  });

  it("PATCH with team.manage edits the role and audits it", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleRolesRequest(
      request("PATCH", { id: EDITOR_ROLE, permissions: [PERMISSIONS.DOCUMENTS_VIEW] }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(w.audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ADMIN, action: "role.update" }),
    );
  });

  it("PATCH on the admin role is 403 even for an admin", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleRolesRequest(
      request("PATCH", { id: ADMIN_ROLE, permissions: [PERMISSIONS.TEAM_MANAGE] }),
      deps,
    );
    expect(response.status).toBe(403);
    expect(w.store.updateRole).not.toHaveBeenCalled();
  });

  it("a database failure is a 500 with no detail", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    w.store.getRole.mockRejectedValue(new Error("db down"));
    const response = await handleRolesRequest(
      request("PATCH", { id: EDITOR_ROLE, permissions: [] }),
      deps,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: expect.not.stringContaining("db down") },
    });
  });
});

describe("createRoleStore", () => {
  /** A service client whose insert works and whose rpc and delete answer as given. */
  function serviceClient(deleteError: { code: string } | null) {
    const deleted = vi.fn(async () => ({ error: deleteError }));
    const client = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: NEW_ROLE }, error: null }),
          }),
        }),
        delete: () => ({ eq: deleted }),
      }),
      rpc: async () => ({ data: null, error: { code: "57014" } }),
    };
    return { client: client as never, deleted };
  }

  it("removes the new role when its permissions can't be written", async () => {
    const { client, deleted } = serviceClient(null);
    const store = createRoleStore(client, client);
    await expect(store.createRole(NEW_ROLE_BODY)).rejects.toThrow("57014");
    expect(deleted).toHaveBeenCalledExactlyOnceWith("id", NEW_ROLE);
  });

  it("reports a cleanup that failed, and still throws the first error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = serviceClient({ code: "40001" });
    const store = createRoleStore(client, client);
    await expect(store.createRole(NEW_ROLE_BODY)).rejects.toThrow("57014");
    expect(log).toHaveBeenCalledWith(expect.stringContaining(NEW_ROLE), "40001");
  });
});
