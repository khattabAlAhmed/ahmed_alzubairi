import { uuidSchema, type RoleKey } from "@repo/shared";

/**
 * The one role this app never grants (§6.19): the first admin is set by hand
 * in the database. This names a data row, not a permission. Permission checks
 * still use `PERMISSIONS` keys only.
 */
export const ADMIN_ROLE_KEY: RoleKey = "admin";

/**
 * Where an invitation carries its role: Clerk copies an invitation's public
 * metadata to the new user's. Only the server can write public metadata.
 */
export const INVITED_ROLE_METADATA_KEY = "roleId";

export type RoleRef = { id: string; key: string };

/** True for the admin role. */
export function isAdminRole(role: RoleRef | null): boolean {
  return role?.key === ADMIN_ROLE_KEY;
}

/** True for a role that exists and may be granted by invite or role change. */
export function isGrantableRole(role: RoleRef | null): role is RoleRef {
  return role !== null && !isAdminRole(role);
}

/** The role id in a Clerk user's or invitation's public metadata, or null. */
export function invitedRoleId(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const value = (metadata as Record<string, unknown>)[INVITED_ROLE_METADATA_KEY];
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
