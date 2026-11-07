import "server-only";
import { contentCacheTag, type Locale } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicLocales, richText, rowsOrThrow, text } from "./rows";
import type { ExpertiseArea, ExpertiseAreaDetail } from "./types";

const COLUMNS =
  "id, slug, title_ar, title_en, summary_ar, summary_en, body_ar, body_en, position, status";

type ExpertiseRow = {
  id: string;
  slug: string;
  title_ar: string | null;
  title_en: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  body_ar: unknown;
  body_en: unknown;
  position: number;
  status: string;
};

function toArea(row: ExpertiseRow, locale: Locale): ExpertiseArea | null {
  const title = text(row, "title", locale);
  const summary = text(row, "summary", locale);
  if (!isPublicIn("expertise_areas", row, locale) || !title || !summary) return null;
  return { id: row.id, slug: row.slug, title, summary };
}

/** Expertise areas in this language, in order (§6.4). */
export async function getExpertiseAreas(locale: Locale): Promise<ExpertiseArea[]> {
  "use cache";
  cacheTag(contentCacheTag("expertise_areas"));
  cacheLife("hours");

  const rows = rowsOrThrow<ExpertiseRow>(
    await createServiceClient()
      .from("expertise_areas")
      .select(COLUMNS)
      .eq("status", "published")
      .order("position"),
    "expertise_areas",
  );
  return rows.flatMap((row) => toArea(row, locale) ?? []);
}

/** One expertise area by slug, or null when it isn't published in this language. */
export async function getExpertiseArea(
  slug: string,
  locale: Locale,
): Promise<ExpertiseAreaDetail | null> {
  "use cache";
  cacheTag(contentCacheTag("expertise_areas"));
  cacheLife("hours");

  const row = rowsOrThrow<ExpertiseRow>(
    await createServiceClient()
      .from("expertise_areas")
      .select(COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .limit(1),
    "expertise_areas",
  ).find((item) => item.slug === slug);
  if (!row) return null;
  const area = toArea(row, locale);
  if (!area) return null;
  return {
    ...area,
    body: richText(row, "body", locale),
    availableIn: publicLocales("expertise_areas", row),
  };
}
