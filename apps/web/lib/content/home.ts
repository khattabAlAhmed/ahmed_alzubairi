import "server-only";
import {
  contentCacheTag,
  homeSectionContentSchemas,
  homeSectionKeySchema,
  type Locale,
} from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicMediaUrl, rowsOrThrow, text } from "./rows";
import type { HomeSection, HomeStat } from "./types";

/** The visible, published home sections in this language, in order (§6.2). */
export async function getHomeSections(locale: Locale): Promise<HomeSection[]> {
  "use cache";
  cacheTag(contentCacheTag("home_sections"));
  cacheLife("hours");

  const rows = rowsOrThrow(
    await createServiceClient()
      .from("home_sections")
      .select("key, position, is_visible, status, content_ar, content_en")
      .eq("status", "published")
      .eq("is_visible", true)
      .order("position"),
    "home_sections",
  );

  return rows
    .filter((row) => row.is_visible && isPublicIn("home_sections", row, locale))
    .sort((a, b) => a.position - b.position)
    .flatMap((row): HomeSection[] => {
      const key = homeSectionKeySchema.parse(row.key);
      const raw = locale === "ar" ? row.content_ar : row.content_en;
      if (key === "hero") {
        const { photoKey, ...content } = homeSectionContentSchemas.hero.parse(raw);
        return [
          { key, position: row.position, content: { ...content, photoUrl: publicMediaUrl(photoKey ?? null) } },
        ];
      }
      if (key === "letter") {
        const { signatureKey, signatureDarkKey, ...content } = homeSectionContentSchemas.letter.parse(raw);
        return [
          {
            key,
            position: row.position,
            content: {
              ...content,
              signatureUrl: publicMediaUrl(signatureKey ?? null),
              signatureDarkUrl: publicMediaUrl(signatureDarkKey ?? null),
            },
          },
        ];
      }
      const content = homeSectionContentSchemas[key].parse(raw);
      return [{ key, position: row.position, content } as HomeSection];
    });
}

/**
 * When the letter was last written: its row's `updated_at`, for the «كُتبت»
 * line beside it. Null when the letter isn't published.
 */
export async function getLetterWrittenAt(): Promise<string | null> {
  "use cache";
  cacheTag(contentCacheTag("home_sections"));
  cacheLife("hours");

  const rows = rowsOrThrow(
    await createServiceClient()
      .from("home_sections")
      .select("updated_at")
      .eq("key", "letter")
      .eq("status", "published")
      .limit(1),
    "home_sections",
  );
  return rows[0]?.updated_at ?? null;
}

/** Quick stats in this language, in order. */
export async function getHomeStats(locale: Locale): Promise<HomeStat[]> {
  "use cache";
  cacheTag(contentCacheTag("home_stats"));
  cacheLife("hours");

  const rows = rowsOrThrow(
    await createServiceClient()
      .from("home_stats")
      .select("id, label_ar, label_en, value, position, status")
      .eq("status", "published")
      .order("position"),
    "home_stats",
  );

  return rows.flatMap((row) => {
    const label = text(row, "label", locale);
    if (!isPublicIn("home_stats", row, locale) || !label || !row.value?.trim()) return [];
    return [{ id: row.id, label, value: row.value }];
  });
}
