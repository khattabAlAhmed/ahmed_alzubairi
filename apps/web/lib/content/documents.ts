import "server-only";
import type { Locale } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { rowsOrThrow, text } from "./rows";
import type { PublicDocument } from "./types";

/**
 * `documents` isn't a `ContentType`, so `packages/shared` has no tag for it.
 * The documents admin routes (Phase 3) must refresh this one. Until it moves
 * into the shared tags, it lives here.
 */
export const DOCUMENTS_CACHE_TAG = "content:documents";

/** The public list: titles and categories only, never the file (§6.12). */
export async function getPublicDocuments(locale: Locale): Promise<PublicDocument[]> {
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
    if (row.status !== "published" || !title) return [];
    return [{ id: row.id, category: row.category, title }];
  });
}
