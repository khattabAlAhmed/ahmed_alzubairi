import "server-only";
import type { Database } from "@repo/db";
import { adminDocumentSchema, type AdminDocument } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStore } from "./handlers";
import { DOCUMENTS_BUCKET } from "./keys";

type Client = SupabaseClient<Database>;

/** Storage's "not found" answers to `info`. */
function isNotFound(error: { message?: string; status?: number; statusCode?: string }) {
  return (
    error.status === 404 ||
    error.statusCode === "404" ||
    /not.?found/i.test(error.message ?? "")
  );
}

/** The columns the list reads. Never `storage_key`: authenticated has no grant on it. */
const LIST_COLUMNS = "id, category, title_ar, title_en, mime, access_mode, status";

/**
 * `user` carries the caller's token, so RLS decides what the list returns
 * (§9). `service` writes and reaches Storage, only after the route's
 * permission check.
 */
export function createDocumentStore(user: Client, service: Client): DocumentStore {
  async function currentKey(id: string): Promise<string | null> {
    const { data, error } = await service
      .from("documents")
      .select("storage_key")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`documents read failed: ${error.code}`);
    return data?.storage_key ?? null;
  }

  return {
    async list() {
      const { data, error } = await user
        .from("documents")
        .select(LIST_COLUMNS)
        .order("category")
        .order("title_en");
      if (error) throw new Error(`documents read failed: ${error.code}`);
      return data.flatMap((row): AdminDocument[] => {
        const parsed = adminDocumentSchema.safeParse({
          id: row.id,
          category: row.category,
          titleAr: row.title_ar,
          titleEn: row.title_en,
          mime: row.mime,
          accessMode: row.access_mode,
          status: row.status,
        });
        return parsed.success ? [parsed.data] : [];
      });
    },

    async fileExists(key) {
      const { error } = await service.storage.from(DOCUMENTS_BUCKET).info(key);
      if (!error) return true;
      if (isNotFound(error as never)) return false;
      throw new Error(`documents info failed: ${error.message}`);
    },

    async keyInUse(key, exceptId) {
      let query = service.from("documents").select("id").eq("storage_key", key).limit(1);
      if (exceptId) query = query.neq("id", exceptId);
      const { data, error } = await query;
      if (error) throw new Error(`documents read failed: ${error.code}`);
      return data.length > 0;
    },

    async insert(row) {
      const { data, error } = await service
        .from("documents")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(`documents insert failed: ${error.code}`);
      return data.id;
    },

    currentKey,

    async update(id, changes) {
      // Nothing to write (a PATCH that resends the same file): the row exists.
      if (Object.keys(changes).length === 0) return (await currentKey(id)) !== null;
      const { data, error } = await service
        .from("documents")
        .update(changes)
        .eq("id", id)
        .select("id");
      if (error) throw new Error(`documents update failed: ${error.code}`);
      return data.length > 0;
    },

    async removeFile(key) {
      const { error } = await service.storage.from(DOCUMENTS_BUCKET).remove([key]);
      if (error) throw new Error(`documents remove failed: ${error.message}`);
    },
  };
}
