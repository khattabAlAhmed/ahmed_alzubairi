import "server-only";
import type { Database } from "@repo/db";
import {
  documentAccessModeSchema,
  localeSchema,
  PERMISSIONS,
  SIGNED_URL_TTL_SECONDS,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StampableMime } from "@/lib/watermark/stamp";
import type { DocumentOpenStore } from "./handlers";

type Client = SupabaseClient<Database>;

const ORIGINALS = "documents";
export const COPIES_BUCKET = "document-views";

/**
 * Storage's answer for a missing object: `code` "NoSuchKey", or, from a
 * server that sends no code, exactly "Object not found". Nothing broader: a
 * missing bucket ("NoSuchBucket", also a 404) is a configuration fault and
 * must still throw.
 */
export function isMissingObject(error: { code?: string; message?: string }): boolean {
  if (error.code !== undefined) return error.code === "NoSuchKey";
  return error.message === "Object not found";
}

const MIMES: readonly StampableMime[] = ["application/pdf", "image/jpeg", "image/png"];
const EXTENSIONS: Record<StampableMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * `user` carries the caller's token: the viewer, the team check and the grant
 * are read through RLS (§9). `service` reads the document's key and the
 * original, logs, and writes the copy, only once access is settled.
 */
export function createDocumentOpenStore(
  user: Client,
  service: Client,
  userId: string,
): DocumentOpenStore {
  return {
    async viewer() {
      const { data, error } = await user
        .from("profiles")
        .select("full_name, locale, timezone")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`profile read failed: ${error.code}`);
      if (!data) return null;
      const locale = localeSchema.safeParse(data.locale);
      return {
        fullName: data.full_name,
        locale: locale.success ? locale.data : "ar",
        timeZone: data.timezone,
      };
    },

    async isTeamViewer() {
      const { data, error } = await user.rpc("has_permission", {
        key: PERMISSIONS.DOCUMENTS_VIEW,
      });
      if (error) throw new Error(`has_permission failed: ${error.code}`);
      return data === true;
    },

    async liveGrant(documentId) {
      // RLS shows a client only their own requests; the client_id filter also
      // keeps a member who can see every request from borrowing someone's.
      const { data, error } = await user
        .from("document_requests")
        .select("id, expires_at")
        .eq("document_id", documentId)
        .eq("client_id", userId)
        .eq("status", "granted")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .limit(1);
      if (error) throw new Error(`document_requests read failed: ${error.code}`);
      return data[0]?.id ?? null;
    },

    async document(documentId) {
      const { data, error } = await service
        .from("documents")
        .select("storage_key, mime, access_mode, title_ar, title_en")
        .eq("id", documentId)
        .maybeSingle();
      if (error) throw new Error(`documents read failed: ${error.code}`);
      if (!data) return null;
      const mime = MIMES.find((known) => known === data.mime);
      const accessMode = documentAccessModeSchema.safeParse(data.access_mode);
      if (!mime || !accessMode.success) throw new Error("document has an unknown type or access mode");
      return {
        storageKey: data.storage_key,
        mime,
        accessMode: accessMode.data,
        titleAr: data.title_ar,
        titleEn: data.title_en,
      };
    },

    async logAccess({ requestId, documentId, action }) {
      const { error } = await service.from("document_access_log").insert({
        request_id: requestId,
        document_id: documentId,
        client_id: userId,
        action,
      });
      if (error) throw new Error(`document_access_log insert failed: ${error.code}`);
    },

    async readOriginal(storageKey) {
      const { data, error } = await service.storage.from(ORIGINALS).download(storageKey);
      if (error && isMissingObject(error as { code?: string; message?: string })) return null;
      if (error) throw new Error(`original download failed: ${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },

    async saveCopy(bytes, mime) {
      const key = `${crypto.randomUUID()}.${EXTENSIONS[mime]}`;
      const { error } = await service.storage
        .from(COPIES_BUCKET)
        .upload(key, bytes, { contentType: mime, upsert: false });
      if (error) throw new Error(`copy upload failed: ${error.message}`);
      return key;
    },

    async signCopy(key, downloadAs) {
      const { data, error } = await service.storage
        .from(COPIES_BUCKET)
        .createSignedUrl(key, SIGNED_URL_TTL_SECONDS, downloadAs ? { download: downloadAs } : undefined);
      if (error) throw new Error(`copy sign failed: ${error.message}`);
      return data.signedUrl;
    },
  };
}
