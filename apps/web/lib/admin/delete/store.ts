import "server-only";
import { UPLOAD_TARGET_RULES, type AdminDeleteType } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENTS_BUCKET } from "@/lib/admin/documents/keys";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments/store";
import type { DeleteStore, StoredFile } from "./handlers";

const MEDIA = UPLOAD_TARGET_RULES.media.bucket;

/**
 * The file column of each content type and the bucket its uploads go to, as
 * the dashboard's fields upload them (`components/dashboard/content/registry.ts`):
 * images to `media`, testimonial letters to `letter`, resources to `resource`.
 * `projects` keeps its images in `project_images.path`.
 */
const FILE_COLUMNS: Partial<Record<AdminDeleteType, { column: string; bucket: string }>> = {
  partners: { column: "logo_path", bucket: MEDIA },
  testimonials: { column: "letter_path", bucket: UPLOAD_TARGET_RULES.letter.bucket },
  posts: { column: "cover_path", bucket: MEDIA },
  media_items: { column: "image_path", bucket: MEDIA },
  resources: { column: "storage_key", bucket: UPLOAD_TARGET_RULES.resource.bucket },
  documents: { column: "storage_key", bucket: DOCUMENTS_BUCKET },
};

/** Postgres `foreign_key_violation`: another row still references this one. */
const FOREIGN_KEY_VIOLATION = "23503";

type Row = Record<string, unknown>;

function fail(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed: ${error.code ?? "error"}`);
}

const keysOf = (rows: Row[] | null, column: string, bucket: string): StoredFile[] =>
  (rows ?? []).flatMap((row) => {
    const key = row[column];
    return typeof key === "string" && key !== "" ? [{ bucket, key }] : [];
  });

/**
 * Service-client store for the delete route. Its client is created only after
 * the route checked `data.delete` (§9). Tables are named from the shared type
 * list, never from raw input.
 */
export function createDeleteStore(service: SupabaseClient): DeleteStore {
  return {
    async exists(type, id) {
      const { data, error } = await service.from(type).select("id").eq("id", id).maybeSingle();
      if (error) fail(`${type} read`, error);
      return data !== null;
    },

    async files(type, id) {
      if (type === "consultations") {
        const { data, error } = await service
          .from("consultation_attachments")
          .select("storage_key")
          .eq("consultation_id", id);
        if (error) fail("attachment keys read", error);
        return keysOf(data as Row[], "storage_key", ATTACHMENTS_BUCKET);
      }
      if (type === "projects") {
        const { data, error } = await service.from("project_images").select("path").eq("project_id", id);
        if (error) fail("project image keys read", error);
        return keysOf(data as Row[], "path", MEDIA);
      }
      const file = FILE_COLUMNS[type];
      if (!file) return [];
      const { data, error } = await service.from(type).select(file.column).eq("id", id).maybeSingle();
      if (error) fail(`${type} file read`, error);
      return keysOf(data ? [data as unknown as Row] : [], file.column, file.bucket);
    },

    async hasLiveGrant(documentId) {
      const { data, error } = await service
        .from("document_requests")
        .select("id")
        .eq("document_id", documentId)
        .eq("status", "granted")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .limit(1);
      if (error) fail("grant read", error);
      return data.length > 0;
    },

    async unlinkDocumentRequests(consultationId) {
      const { error } = await service
        .from("document_requests")
        .update({ consultation_id: null })
        .eq("consultation_id", consultationId);
      if (error) fail("document request unlink", error);
    },

    async deleteConsultationChildren(consultationId) {
      for (const table of ["consultation_attachments", "consultation_messages", "meetings"]) {
        const { error } = await service.from(table).delete().eq("consultation_id", consultationId);
        if (error) fail(`${table} delete`, error);
      }
    },

    async deleteRow(type, id) {
      const { data, error } = await service.from(type).delete().eq("id", id).select("id");
      if (error) {
        if (error.code === FOREIGN_KEY_VIOLATION) return "in_use";
        fail(`${type} delete`, error);
      }
      return data.length > 0 ? "deleted" : "not_found";
    },

    async removeFiles(files) {
      const byBucket = new Map<string, string[]>();
      for (const file of files) byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.key]);
      for (const [bucket, keys] of byBucket) {
        const { error } = await service.storage.from(bucket).remove(keys);
        if (error) throw new Error(`storage remove failed in ${bucket}`);
      }
    },
  };
}
