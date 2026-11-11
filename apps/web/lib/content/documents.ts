import "server-only";
import {
  DOCUMENTS_CACHE_TAG,
  documentCategorySchema,
  type DocumentCategory,
  type Locale,
} from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { rowsOrThrow, text } from "./rows";
import type { PublicDocument } from "./types";

/** Kept here too: `lib/content` re-exports the tag from this file. */
export { DOCUMENTS_CACHE_TAG };

/**
 * The public list: titles and categories only, never the file (§6.12). A row
 * with a category the app doesn't know is left out, since it has no label.
 */
export async function getPublicDocuments(
  locale: Locale,
): Promise<(PublicDocument & { category: DocumentCategory })[]> {
  "use cache";
  cacheTag(DOCUMENTS_CACHE_TAG);
  cacheLife("hours");

  // `storage_key`, `mime` and `access_mode` are never selected.
  const rows = rowsOrThrow(
    await createServiceClient()
      .from("documents")
      .select("id, category, title_ar, title_en, status")
      .eq("status", "published")
      .order("category"),
    "documents",
  );

  return rows.flatMap((row) => {
    const title = text(row, "title", locale);
    const category = documentCategorySchema.safeParse(row.category);
    if (row.status !== "published" || !title || !category.success) return [];
    return [{ id: row.id, category: category.data, title }];
  });
}
