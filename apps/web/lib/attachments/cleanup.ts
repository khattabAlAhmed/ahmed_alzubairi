import "server-only";
import type { Database } from "@repo/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENTS_BUCKET } from "./store";

/** How long a Supabase signed upload URL stays usable (fixed by Storage). */
export const SIGNED_UPLOAD_LIFETIME_MS = 2 * 60 * 60 * 1000;

/**
 * An upload not finalized within this time is abandoned. Longer than the
 * signed upload URL lives, so a row is never deleted while its URL can still
 * write the object (which would leave an object with no row).
 */
export const UPLOADING_MAX_AGE_MS = SIGNED_UPLOAD_LIFETIME_MS + 5 * 60 * 1000;

/** A finalized file no message took within this time is abandoned. */
export const UNLINKED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Rows one run deletes; the rest wait for the next run. */
export const CLEANUP_BATCH_SIZE = 500;

export type CleanupDb = {
  /**
   * Deletes the abandoned rows, re-checking the conditions in the same
   * statement, and returns their storage keys. A row a message linked
   * meanwhile no longer matches and stays.
   */
  deleteAbandoned: (cutoffs: { uploading: string; unlinked: string }) => Promise<string[]>;
  removeObjects: (keys: string[]) => Promise<void>;
};

export function createCleanupDb(service: SupabaseClient<Database>): CleanupDb {
  return {
    async deleteAbandoned({ uploading, unlinked }) {
      const abandoned = `and(status.eq.uploading,created_at.lt.${uploading}),and(status.eq.ready,message_id.is.null,created_at.lt.${unlinked})`;
      const found = await service
        .from("consultation_attachments")
        .select("id")
        .or(abandoned)
        .order("created_at")
        .limit(CLEANUP_BATCH_SIZE);
      if (found.error) throw new Error(`attachment cleanup read failed: ${found.error.code}`);
      if (found.data.length === 0) return [];
      const deleted = await service
        .from("consultation_attachments")
        .delete()
        .in(
          "id",
          found.data.map((row) => row.id),
        )
        .or(abandoned)
        .select("storage_key");
      if (deleted.error) throw new Error(`attachment cleanup delete failed: ${deleted.error.code}`);
      return deleted.data.map((row) => row.storage_key);
    },

    async removeObjects(keys) {
      if (keys.length === 0) return;
      // Storage skips keys that are already gone, so a second run is harmless.
      const { error } = await service.storage.from(ATTACHMENTS_BUCKET).remove(keys);
      if (error) throw new Error("attachment cleanup storage remove failed");
    },
  };
}

/**
 * The hourly job's part for attachments (§8 System): `uploading` rows older
 * than 2 h 5 min (past the signed URL's life) and `ready` rows no message took after 24 hours are deleted,
 * then their objects. Rows go first, so a file is never removed while its row
 * could still be linked. Safe to run twice at once: the second run finds the
 * rows gone. An object whose removal fails is orphaned in the private bucket,
 * never reachable, and the error is logged by the cron route.
 */
export async function cleanupAttachments(
  db: CleanupDb,
  now: number = Date.now(),
): Promise<{ deleted: number }> {
  const keys = await db.deleteAbandoned({
    uploading: new Date(now - UPLOADING_MAX_AGE_MS).toISOString(),
    unlinked: new Date(now - UNLINKED_MAX_AGE_MS).toISOString(),
  });
  await db.removeObjects(keys);
  return { deleted: keys.length };
}
