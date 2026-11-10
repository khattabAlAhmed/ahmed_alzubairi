import "server-only";
import { contentCacheTag, type Locale } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicLocales, rowsOrThrow, text } from "./rows";
import type { Service, ServiceDetail } from "./types";

const COLUMNS =
  "id, slug, expertise_id, title_ar, title_en, summary_ar, summary_en, audience_ar, audience_en, deliverables_ar, deliverables_en, stages_ar, stages_en, is_featured, position, status";

type ServiceRow = Record<string, unknown> & {
  id: string;
  slug: string;
  expertise_id: string | null;
  is_featured: boolean;
  status: string;
};

/** The one rule for "public in this language", shared by every read below. */
function isListed(row: Record<string, unknown>, locale: Locale) {
  return isPublicIn("services", row, locale);
}

function toService(row: ServiceRow, locale: Locale): Service | null {
  const title = text(row, "title", locale);
  const summary = text(row, "summary", locale);
  if (!isListed(row, locale) || !title || !summary) return null;
  return {
    id: row.id,
    slug: row.slug,
    expertiseId: row.expertise_id,
    title,
    summary,
    isFeatured: row.is_featured,
  };
}

/** Services in this language, in order (§6.5). */
export async function getServices(locale: Locale): Promise<Service[]> {
  "use cache";
  cacheTag(contentCacheTag("services"));
  cacheLife("hours");

  const rows = rowsOrThrow<ServiceRow>(
    await createServiceClient()
      .from("services")
      .select(COLUMNS)
      .eq("status", "published")
      .order("position"),
    "services",
  );
  return rows.flatMap((row) => toService(row, locale) ?? []);
}

/** One service by slug, or null when it isn't published in this language. */
export async function getService(slug: string, locale: Locale): Promise<ServiceDetail | null> {
  "use cache";
  cacheTag(contentCacheTag("services"));
  cacheLife("hours");

  const row = rowsOrThrow<ServiceRow>(
    await createServiceClient()
      .from("services")
      .select(COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .limit(1),
    "services",
  ).find((item) => item.slug === slug);
  if (!row) return null;
  const service = toService(row, locale);
  if (!service) return null;
  return {
    ...service,
    audience: text(row, "audience", locale),
    deliverables: text(row, "deliverables", locale),
    stages: text(row, "stages", locale),
    availableIn: publicLocales("services", row),
  };
}

/**
 * True when `getService` would return this slug in this language. Not cached,
 * so the proxy can call it: a `"use cache"` function throws there. It reads
 * one row and only the columns the rule needs.
 */
export async function hasService(slug: string, locale: Locale): Promise<boolean> {
  const rows = rowsOrThrow<Record<string, unknown>>(
    await createServiceClient()
      .from("services")
      .select(`slug, status, title_${locale}, summary_${locale}`)
      .eq("slug", slug)
      .eq("status", "published")
      .limit(1),
    "services",
  );
  return rows.some((row) => row.slug === slug && isListed(row, locale));
}
