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

type LocaleParams = Promise<{ locale: string }>;

/** The page's locale and its full path, such as `/ar/account/documents`. */
async function pageTarget(params: LocaleParams, page: string) {
  const { locale } = await params;
  const known = LOCALES.find((item) => item === locale);
  if (!known) notFound();
  return { locale: known, path: `/${known}${page}` };
}

async function requireUserId(locale: Locale, path: string) {
  const { userId } = await auth();
  // proxy.ts already sends signed-out visitors to sign-in; this is the backstop.
  if (!userId) redirect(signInPath(locale, path));
  return userId;
}

/**
 * Account pages: a user with no profile goes to onboarding, carrying the page
 * they asked for. Call it at the top of every account page, not in the layout:
 * a layout doesn't run again when the user moves between its pages.
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
