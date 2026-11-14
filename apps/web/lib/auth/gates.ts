import "server-only";
import { auth } from "@clerk/nextjs/server";
import { LOCALES, type Locale } from "@repo/shared";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createUserClient } from "@/lib/supabase/user";
import { canOpenDashboard, type ProfileAccess } from "./profile-access";
import { onboardingPath, signInPath } from "./return-path";

/**
 * The signed-in user's own `profiles` row, or null. It reads through the user
 * client, so RLS applies. The filter is still needed: RLS also shows other
 * rows to members with `clients.view_all` or `team.manage`.
 */
export const readOwnProfile = cache(
  async (userId: string): Promise<ProfileAccess | null> => {
    const { data, error } = await createUserClient()
      .from("profiles")
      .select("role_id, status")
      .eq("clerk_user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`profile read failed: ${error.code}`);
    return data;
  },
);

/** Where `withQuery` puts the query. A symbol, so no route segment can take its name. */
const QUERY = Symbol("gate query");

type RouteParams = { locale: string; [QUERY]?: string } & Record<string, unknown>;
type LocaleParams = Promise<RouteParams>;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The route's params with the named query keys added, so the gate's redirects
 * carry them through sign-in and onboarding and back (§6.16), for example
 * `?service=` on the consultation form. Only the named keys, and each only
 * when it has exactly one value.
 */
export async function withQuery<Params extends { locale: string }>(
  params: Promise<Params>,
  searchParams: SearchParams,
  keys: readonly string[],
): Promise<Params & { [QUERY]?: string }> {
  const [route, search] = await Promise.all([params, searchParams]);
  const kept = new URLSearchParams();
  for (const key of keys) {
    const value = search[key];
    if (typeof value === "string" && value !== "") kept.set(key, value);
  }
  const query = kept.toString();
  return query ? { ...route, [QUERY]: `?${query}` } : route;
}

/**
 * The page's locale and its full path, such as `/ar/account/documents`. A
 * dynamic segment in `page`, such as `[id]`, is filled from the params.
 */
async function pageTarget(params: LocaleParams, page: string) {
  const route = await params;
  const known = LOCALES.find((item) => item === route.locale);
  if (!known) notFound();
  const filled = page.replace(/\[([^\]]+)\]/g, (_, name: string) => {
    const value = route[name];
    if (typeof value !== "string" || value === "") notFound();
    return encodeURIComponent(value);
  });
  return { locale: known, path: `/${known}${filled}${route[QUERY] ?? ""}` };
}

async function requireUserId(locale: Locale, path: string) {
  const { userId } = await auth();
  // proxy.ts already sends signed-out visitors to sign-in; this is the backstop.
  if (!userId) redirect(signInPath(locale, path));
  return userId;
}

/**
 * Account pages: a user with no profile goes to onboarding, carrying the page
 * they asked for (with its query, when the page passes `withQuery`). Call it
 * at the top of every account page, not in the layout: a layout doesn't run
 * again when the user moves between its pages.
 */
export async function requireProfile(params: LocaleParams, page: string) {
  const { locale, path } = await pageTarget(params, page);
  const userId = await requireUserId(locale, path);
  const profile = await readOwnProfile(userId);
  if (!profile) redirect(onboardingPath(locale, path));
  return profile;
}

/** Dashboard pages: only an active profile with a role. Everyone else goes to the account. */
export async function requireTeamMember(params: LocaleParams, page: string) {
  const { locale, path } = await pageTarget(params, page);
  const userId = await requireUserId(locale, path);
  const profile = await readOwnProfile(userId);
  if (!canOpenDashboard(profile)) redirect(`/${locale}/account`);
  return profile;
}
