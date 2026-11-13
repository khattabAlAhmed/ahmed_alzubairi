import "server-only";
import type { Database } from "@repo/db";
import { localeSchema, orgTypeSchema, type Locale, type OrgType } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/user";
import type { ProfileUpdateRow } from "./update";

/** What the profile page shows and edits. */
export type OwnProfile = {
  fullName: string;
  email: string;
  phone: string;
  orgType: OrgType | null;
  orgName: string | null;
  jobTitle: string | null;
  locale: Locale;
  timezone: string;
  notifyOptional: boolean;
  /** A team member: the page hides the disable block. */
  isMember: boolean;
};

export const OWN_PROFILE_COLUMNS =
  "full_name, email, phone, org_type, org_name, job_title, locale, timezone, notify_optional, role_id";

/**
 * The signed-in user's own row, read with their own client (RLS). The filter
 * is still needed: RLS also shows other rows to some team members.
 */
export async function readOwnProfileDetails(
  userId: string,
  client: SupabaseClient<Database> = createUserClient(),
): Promise<OwnProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(OWN_PROFILE_COLUMNS)
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`profile read failed: ${error.code}`);
  if (!data) return null;
  const orgType = orgTypeSchema.safeParse(data.org_type);
  const locale = localeSchema.safeParse(data.locale);
  return {
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    orgType: orgType.success ? orgType.data : null,
    orgName: data.org_name,
    jobTitle: data.job_title,
    locale: locale.success ? locale.data : "ar",
    timezone: data.timezone,
    notifyOptional: data.notify_optional,
    isMember: data.role_id !== null,
  };
}

/**
 * Writes the caller's own row with the service client. Call it only after the
 * route has read the user from the session (§9): the id never comes from the
 * request.
 */
export async function writeOwnProfile(
  service: SupabaseClient<Database>,
  userId: string,
  row: ProfileUpdateRow,
): Promise<boolean> {
  const { data, error } = await service
    .from("profiles")
    .update(row)
    .eq("clerk_user_id", userId)
    .select("clerk_user_id");
  if (error) throw new Error(`profile update failed: ${error.code}`);
  return data.length > 0;
}
