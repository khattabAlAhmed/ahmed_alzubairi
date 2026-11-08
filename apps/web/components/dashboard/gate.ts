import "server-only";
import { LOCALES, type Locale, type Permission } from "@repo/shared";
import { holdsPermission } from "./access";

type LocaleParams = Promise<{ locale: string }>;

export type SectionAccess = { locale: Locale; allowed: boolean };

/**
 * Whether the member may open a dashboard section, decided on the server.
 * Pages call `requireTeamMember(params, "<page>")` first (it redirects anyone
 * who isn't a team member), then this, and show `<Refusal />` when `allowed`
 * is false. Takes a `PERMISSIONS` key, never a role name.
 */
export async function sectionAccess(
  params: LocaleParams,
  permission: Permission,
): Promise<SectionAccess> {
  const { locale: raw } = await params;
  // requireTeamMember already sent unknown locales to "not found".
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  return { locale, allowed: await holdsPermission(permission, locale) };
}
