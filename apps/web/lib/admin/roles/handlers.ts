import {
  createRoleRequestSchema,
  updateRoleRequestSchema,
  type AdminRole,
  type AdminRoleListResponse,
  type CreateRoleRequest,
  type Locale,
  type OkResponse,
  type Permission,
} from "@repo/shared";
import type { AuditEntry } from "../audit";
import { adminError, baseError, type AdminError } from "../permissions";
import { isAdminRole } from "../team/rules";

/** What a PATCH changes. A field that is absent stays as it is. */
export type RoleChanges = {
  nameAr?: string;
  nameEn?: string;
  permissions?: Permission[];
};

/**
 * The database, behind an interface so tests can replace it. Created only
 * after `requirePermission(team.manage)` passed. Reads use the user client, so
 * RLS scopes them; the writes use the service client.
 */
export type RoleStore = {
  /** Every role with its permissions, system roles first, then by key. */
  listRoles: () => Promise<AdminRole[]>;
  getRole: (id: string) => Promise<AdminRole | null>;
  /** The new role's id, or `key_taken` when another role has the key. */
  createRole: (
    input: CreateRoleRequest,
  ) => Promise<{ ok: true; id: string } | { ok: false; reason: "key_taken" }>;
  /**
   * Writes the names and replaces the permission set, whole or not at all.
   * False when the role is gone or is the admin role: nothing was written.
   */
  updateRole: (id: string, changes: RoleChanges) => Promise<boolean>;
};

export type RoleDeps = {
  locale: Locale;
  /** The acting user from the session. */
  userId: string;
  store: RoleStore;
  audit: (entry: AuditEntry) => Promise<void>;
};

type Ok = { status: 200; body: OkResponse };

const OK: Ok = { status: 200, body: { ok: true } };

/** Sorted, so two lists with the same keys are equal and the log reads the same. */
function sorted(permissions: readonly Permission[]): Permission[] {
  return [...permissions].sort();
}

function sameSet(a: readonly Permission[], b: readonly Permission[]): boolean {
  return a.length === b.length && sorted(a).join() === sorted(b).join();
}

/** `GET /api/admin/roles`, after the permission check. */
export async function listRoles({
  store,
}: Pick<RoleDeps, "store">): Promise<{
  status: 200;
  body: AdminRoleListResponse;
}> {
  return { status: 200, body: { roles: await store.listRoles() } };
}

/**
 * `POST /api/admin/roles`, after the permission check. A new role is never a
 * system role, and its key never changes afterwards.
 */
export async function createRole(
  rawBody: unknown,
  { locale, userId, store, audit }: RoleDeps,
): Promise<Ok | AdminError> {
  const body = createRoleRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);

  const created = await store.createRole(body.data);
  if (!created.ok) return adminError("conflict", 409, "roleKeyTaken", locale);

  await audit({
    actorId: userId,
    action: "role.create",
    entity: "roles",
    entityId: created.id,
    metadata: { key: body.data.key, from: [], to: sorted(body.data.permissions) },
  });
  return OK;
}

/**
 * `PATCH /api/admin/roles`, after the permission check: a role's names, its
 * permissions, or both. The admin role is refused whatever the change: taking
 * a permission from it could lock everyone out (§6.19), so only SQL edits it.
 */
export async function updateRole(
  rawBody: unknown,
  { locale, userId, store, audit }: RoleDeps,
): Promise<Ok | AdminError> {
  const body = updateRoleRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);
  const { id, nameAr, nameEn, permissions } = body.data;

  const notFound = adminError("not_found", 404, "notFound", locale);
  const role = await store.getRole(id);
  if (!role) return notFound;
  if (isAdminRole(role)) {
    return adminError("forbidden", 403, "roleAdminLocked", locale);
  }

  const changes: RoleChanges = {};
  if (nameAr !== undefined && nameAr !== role.nameAr) changes.nameAr = nameAr;
  if (nameEn !== undefined && nameEn !== role.nameEn) changes.nameEn = nameEn;
  if (permissions !== undefined && !sameSet(permissions, role.permissions)) {
    changes.permissions = permissions;
  }
  // Nothing differs: no write and no audit row.
  if (Object.keys(changes).length === 0) return OK;

  // The role was deleted by hand since the read above.
  if (!(await store.updateRole(id, changes))) return notFound;

  await audit({
    actorId: userId,
    action: "role.update",
    entity: "roles",
    entityId: id,
    metadata: {
      from: sorted(role.permissions),
      to: sorted(changes.permissions ?? role.permissions),
      renamed: changes.nameAr !== undefined || changes.nameEn !== undefined,
    },
  });
  return OK;
}
