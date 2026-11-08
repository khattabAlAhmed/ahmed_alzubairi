import "server-only";
import type { Locale, Permission } from "@repo/shared";
import { cache } from "react";
import { requirePermission } from "@/lib/admin/permissions";

/**
 * Whether the signed-in member holds a permission, checked on the server by
 * `has_permission` through RLS. Cached per request, so the menu and the page
 * share one check. Takes a `PERMISSIONS` key, never a role name.
 *
 * Pages call `requireTeamMember` first, then this, and show `<Refusal />`
 * when it is false.
 */
export const holdsPermission = cache(
  async (key: Permission, locale: Locale): Promise<boolean> =>
    (await requirePermission(key, { locale })).ok,
);

/** The permissions in `keys` the member holds. */
export async function grantedPermissions(
  keys: readonly Permission[],
  locale: Locale,
  check: (key: Permission, locale: Locale) => Promise<boolean> = holdsPermission,
): Promise<Set<Permission>> {
  const results = await Promise.all(keys.map((key) => check(key, locale)));
  return new Set(keys.filter((_, index) => results[index]));
}
