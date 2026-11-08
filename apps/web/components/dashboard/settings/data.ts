import "server-only";
import { parseSiteSettings, type SiteSettings } from "@repo/shared";
import { createUserClient } from "@/lib/supabase/user";

/**
 * Every setting, read with the member's own client: RLS lets in only
 * `team.manage`. Values that fail their schema are dropped.
 */
export async function loadSettings(): Promise<SiteSettings> {
  const { data, error } = await createUserClient()
    .from("site_settings")
    .select("key, value");
  if (error) throw new Error(`site_settings read failed: ${error.code}`);
  return parseSiteSettings(data ?? []);
}
