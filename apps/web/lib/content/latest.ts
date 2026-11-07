import "server-only";
import {
  contentCacheTag,
  mediaCategorySchema,
  resourceAccessSchema,
  resourceKindSchema,
  type Locale,
} from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicMediaUrl, rowsOrThrow, text } from "./rows";
import type { MediaItem, Post, Resource } from "./types";

/** The newest posts in this language, for the home page (§6.2 #10). */
export async function getLatestPosts(locale: Locale, limit: number): Promise<Post[]> {
  "use cache";
  cacheTag(contentCacheTag("posts"));
  cacheLife("hours");

  const rows = rowsOrThrow(
    await createServiceClient()
      .from("posts")
      .select("id, slug_ar, slug_en, title_ar, title_en, excerpt_ar, excerpt_en, body_ar, body_en, cover_path, reading_minutes_ar, reading_minutes_en, published_at, status")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false }),
    "posts",
  );

  return rows
    .flatMap((row): Post[] => {
      const slug = text(row, "slug", locale);
      const title = text(row, "title", locale);
      if (!isPublicIn("posts", row, locale) || !slug || !title) return [];
      const minutes = locale === "ar" ? row.reading_minutes_ar : row.reading_minutes_en;
      return [
        {
          id: row.id,
          slug,
          title,
          excerpt: text(row, "excerpt", locale),
          coverUrl: publicMediaUrl(row.cover_path),
          readingMinutes: minutes,
          publishedAt: row.published_at,
        },
      ];
    })
    .slice(0, limit);
}

/** The newest free resources in this language. The file stays behind the download route. */
export async function getLatestResources(locale: Locale, limit: number): Promise<Resource[]> {
  "use cache";
  cacheTag(contentCacheTag("resources"));
  cacheLife("hours");

  // `storage_key` is never selected: the file goes out only by signed URL.
  const rows = rowsOrThrow(
    await createServiceClient()
      .from("resources")
      .select("id, kind, title_ar, title_en, description_ar, description_en, access, status, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    "resources",
  );

  return rows
    .flatMap((row): Resource[] => {
      const title = text(row, "title", locale);
      const kind = resourceKindSchema.safeParse(row.kind);
      const access = resourceAccessSchema.safeParse(row.access);
      if (!isPublicIn("resources", row, locale) || !title || !kind.success || !access.success) return [];
      return [
        { id: row.id, kind: kind.data, title, description: text(row, "description", locale), access: access.data },
      ];
    })
    .slice(0, limit);
}

/** The newest media appearances and events in this language (§6.2 #9). */
export async function getLatestMediaItems(locale: Locale, limit: number): Promise<MediaItem[]> {
  "use cache";
  cacheTag(contentCacheTag("media_items"));
  cacheLife("hours");

  const rows = rowsOrThrow(
    await createServiceClient()
      .from("media_items")
      .select("id, category, title_ar, title_en, outlet_ar, outlet_en, date, image_path, url, video_url, status")
      .eq("status", "published")
      .order("date", { ascending: false, nullsFirst: false }),
    "media_items",
  );

  return rows
    .flatMap((row): MediaItem[] => {
      const title = text(row, "title", locale);
      const category = mediaCategorySchema.safeParse(row.category);
      if (!isPublicIn("media_items", row, locale) || !title || !category.success) return [];
      return [
        {
          id: row.id,
          category: category.data,
          title,
          outlet: text(row, "outlet", locale),
          date: row.date,
          imageUrl: publicMediaUrl(row.image_path),
          url: row.url,
          videoUrl: row.video_url,
        },
      ];
    })
    .slice(0, limit);
}
