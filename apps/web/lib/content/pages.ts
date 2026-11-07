import "server-only";
import { contentCacheTag, type Locale, type PageKey } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicLocales, richText, rowsOrThrow, text } from "./rows";
import type { Page, TimelineItem } from "./types";

/** About, privacy or terms in this language, or null when it isn't published in it. */
export async function getPage(key: PageKey, locale: Locale): Promise<Page | null> {
  "use cache";
  cacheTag(contentCacheTag("pages"));
  cacheLife("hours");

  const row = rowsOrThrow(
    await createServiceClient()
      .from("pages")
      .select("key, title_ar, title_en, body_ar, body_en, status")
      .eq("key", key)
      .eq("status", "published")
      .limit(1),
    "pages",
  ).find((item) => item.key === key);
  if (!row || !isPublicIn("pages", row, locale)) return null;

  const title = text(row, "title", locale);
  const body = richText(row, "body", locale);
  if (!title || !body) return null;
  return { key, title, body, availableIn: publicLocales("pages", row) };
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
