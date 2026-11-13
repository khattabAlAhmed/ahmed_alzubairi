import { PERMISSIONS, type AdminRole, type Permission } from "@repo/shared";
import { isAdminRole } from "@/lib/admin/team/rules";

/** The 14 permissions in the order of the §5 table. */
export const PERMISSION_LIST: readonly Permission[] = Object.values(PERMISSIONS);

/**
 * The message key of a permission's "what it allows" text, under
 * `DashboardTeam.permissions`. A key such as `content.manage` is already a
 * nested message path.
 */
export function permissionLabelKey(key: Permission): `permissions.${Permission}` {
  return `permissions.${key}`;
}

/** The roles the invite form and the role change offer: never the admin role (§6.19). */
export function grantableRoles(roles: readonly AdminRole[]): AdminRole[] {
  return roles.filter((role) => !isAdminRole(role));
}

/** A role's name in the UI language. */
export function roleName(role: Pick<AdminRole, "nameAr" | "nameEn">, locale: string): string {
  return locale === "ar" ? role.nameAr : role.nameEn;
}

/** True when the two lists hold the same permissions, in any order. */
export function samePermissions(a: readonly Permission[], b: readonly Permission[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((key) => set.has(key));
}

/** The list with `key` added or removed, in the §5 order. */
export function togglePermission(
  list: readonly Permission[],
  key: Permission,
  on: boolean,
): Permission[] {
  const set = new Set(list);
  if (on) set.add(key);
  else set.delete(key);
  return PERMISSION_LIST.filter((item) => set.has(item));
}
