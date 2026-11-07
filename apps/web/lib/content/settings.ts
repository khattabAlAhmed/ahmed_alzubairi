import "server-only";
import { parseSiteSettings, SITE_SETTINGS_CACHE_TAG } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { publicMediaUrl, rowsOrThrow } from "./rows";
import type { PublicSiteSettings } from "./types";

/**
 * Contact details, social links and the CV for public pages. Values that fail
 * their schema are dropped by `parseSiteSettings`. The CV's storage key never
 * leaves this module: it becomes a URL, and only when `cv_visible` is on.
 */
export async function getSiteSettings(): Promise<PublicSiteSettings> {
  "use cache";
  cacheTag(SITE_SETTINGS_CACHE_TAG);
  cacheLife("hours");

  const settings = parseSiteSettings(
    rowsOrThrow(
      await createServiceClient().from("site_settings").select("key, value"),
      "site_settings",
    ),
  );

  return {
    contactEmail: settings.contact_email ?? null,
    whatsappNumber: settings.whatsapp_number ?? null,
    linkedinUrl: settings.linkedin_url ?? null,
    socialLinks: settings.social_links ?? [],
    cvUrl: settings.cv_visible === true ? publicMediaUrl(settings.cv_file_key ?? null) : null,
  };
}
