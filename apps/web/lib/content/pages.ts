import "server-only";
import { contentCacheTag, type Locale, type PageKey } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicLocales, publicMediaUrl, richText, rowsOrThrow, text } from "./rows";
import type { ContentImage, Page, TimelineItem } from "./types";

/** The photo columns of `pages` and `expertise_areas` (P8D-T41). */
export const IMAGE_COLUMNS =
  "image_path, image_alt_ar, image_alt_en, image_caption_ar, image_caption_en";

/**
 * A row's photo in this language: its public URL with alt and caption, or
 * null when there's no photo or no alt in this language.
 */
export function contentImage(row: Record<string, unknown>, locale: Locale): ContentImage | null {
  const path = typeof row.image_path === "string" ? row.image_path : null;
  const url = publicMediaUrl(path);
  const alt = text(row, "image_alt", locale);
  if (!url || !alt) return null;
  return { url, alt, caption: text(row, "image_caption", locale) };
}

/** About, privacy or terms in this language, or null when it isn't published in it. */
export async function getPage(key: PageKey, locale: Locale): Promise<Page | null> {
  "use cache";
  cacheTag(contentCacheTag("pages"));
  cacheLife("hours");

  const row = rowsOrThrow(
    await createServiceClient()
      .from("pages")
      .select(`key, title_ar, title_en, body_ar, body_en, status, updated_at, ${IMAGE_COLUMNS}`)
      .eq("key", key)
      .eq("status", "published")
      .limit(1),
    "pages",
  ).find((item) => item.key === key);
  if (!row || !isPublicIn("pages", row, locale)) return null;

  const title = text(row, "title", locale);
  const body = richText(row, "body", locale);
  if (!title || !body) return null;
  return {
    key,
    title,
    body,
    updatedAt: row.updated_at,
    availableIn: publicLocales("pages", row),
    image: contentImage(row, locale),
  };
}

/** Career and qualification items for About, in order (§6.3). */
export async function getTimeline(locale: Locale): Promise<TimelineItem[]> {
  "use cache";
  cacheTag(contentCacheTag("timeline_items"));
  cacheLife("hours");

  const rows = rowsOrThrow(
    await createServiceClient()
      .from("timeline_items")
      .select("id, kind, title_ar, title_en, description_ar, description_en, period, position, status")
      .eq("status", "published")
      .order("position"),
    "timeline_items",
  );

  return rows.flatMap((row) => {
    const title = text(row, "title", locale);
    if (!isPublicIn("timeline_items", row, locale) || !title) return [];
    return [
      {
        id: row.id,
        kind: row.kind as TimelineItem["kind"],
        title,
        description: text(row, "description", locale),
        period: row.period,
      },
    ];
  });
}
