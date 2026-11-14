import "server-only";
import type { Database } from "@repo/db";
import type { FileMime } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** The private bucket for consultation files (§7). */
export const ATTACHMENTS_BUCKET = "attachments";

/** How long a download link lasts (§9: signed URLs last 60 seconds). */
export const DOWNLOAD_URL_SECONDS = 60;

/** What finalize needs about an attachment, read with the service client. */
export type PendingAttachment = {
  consultationId: string;
  storageKey: string;
  mime: string;
  status: string;
  uploadedBy: string;
};

/**
 * The `consultation_attachments` rows, behind an interface so tests can
 * replace them. `visible` reads through the user client, so RLS decides
 * whether the caller sees the file's consultation. Everything else uses the
 * service client and runs only after the route's identity and access checks.
 * Storage itself goes through lib/admin/uploads' `UploadStore`.
 */
export type AttachmentStore = {
  insertUploading: (row: {
    id: string;
    consultationId: string;
    storageKey: string;
    fileName: string;
    mime: FileMime;
    sizeBytes: number;
    uploadedBy: string;
  }) => Promise<void>;
  /** The row finalize checks, or null (service client). */
  pending: (id: string) => Promise<PendingAttachment | null>;
  /**
   * `uploading` → `ready`, with the real size. False when the row is gone or
   * no longer uploading (the cleanup job took it, or another finalize won).
   */
  markReady: (id: string, sizeBytes: number) => Promise<boolean>;
  deleteRow: (id: string) => Promise<void>;
  /** The attachment as RLS shows it to the caller, or null (user client). */
  visible: (id: string) => Promise<{ status: string } | null>;
  /** Its storage key and file name, after `visible` passed (service client). */
  objectOf: (id: string) => Promise<{ storageKey: string; fileName: string } | null>;
  /** A 60-second link that downloads the file under its name, never inline. */
  signDownload: (storageKey: string, fileName: string) => Promise<string>;
};

function fail(what: string, error: { code?: string; message?: string }): never {
  // Storage errors carry no code; their message names no user data.
  throw new Error(`${what} failed: ${error.code ?? error.message ?? "error"}`);
}

export function createAttachmentStore(user: Client, service: Client): AttachmentStore {
  return {
    async insertUploading(row) {
      const { error } = await service.from("consultation_attachments").insert({
        id: row.id,
        consultation_id: row.consultationId,
        storage_key: row.storageKey,
        file_name: row.fileName,
        mime: row.mime,
        size_bytes: row.sizeBytes,
        status: "uploading",
        uploaded_by: row.uploadedBy,
      });
      if (error) fail("attachment insert", error);
    },

    async pending(id) {
      const { data, error } = await service
        .from("consultation_attachments")
        .select("consultation_id, storage_key, mime, status, uploaded_by")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("attachment read", error);
      if (!data) return null;
      return {
        consultationId: data.consultation_id,
        storageKey: data.storage_key,
        mime: data.mime,
        status: data.status,
        uploadedBy: data.uploaded_by,
      };
    },

    async markReady(id, sizeBytes) {
      const { data, error } = await service
        .from("consultation_attachments")
        .update({ status: "ready", size_bytes: sizeBytes })
        .eq("id", id)
        .eq("status", "uploading")
        .select("id");
      if (error) fail("attachment ready", error);
      return data.length === 1;
    },

    async deleteRow(id) {
      const { error } = await service.from("consultation_attachments").delete().eq("id", id);
      if (error) fail("attachment delete", error);
    },

    async visible(id) {
      // RLS: only attachments on a consultation the caller sees. The key isn't
      // granted to this role, so it isn't asked for.
      const { data, error } = await user
        .from("consultation_attachments")
        .select("id, status")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("attachment read", error);
      return data ? { status: data.status } : null;
    },

    async objectOf(id) {
      const { data, error } = await service
        .from("consultation_attachments")
        .select("storage_key, file_name")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("attachment read", error);
      return data ? { storageKey: data.storage_key, fileName: data.file_name } : null;
    },

    async signDownload(storageKey, fileName) {
      const { data, error } = await service.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(storageKey, DOWNLOAD_URL_SECONDS, { download: fileName });
      if (error) fail("createSignedUrl", error);
      return data.signedUrl;
    },
  };
}
