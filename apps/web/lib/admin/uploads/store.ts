import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fileTypeFromStream } from "file-type";
import type { DetectMime, UploadStore } from "./handlers";

/** Storage's "not found" errors, for `info` on a missing object. */
function isNotFound(error: { message?: string; status?: number; statusCode?: string }) {
  return (
    error.status === 404 ||
    error.statusCode === "404" ||
    /not.?found/i.test(error.message ?? "")
  );
}

/** Storage through the service client. Call only after the permission check. */
export function createUploadStore(service: SupabaseClient): UploadStore {
  return {
    async signUpload(bucket, path) {
      // No upsert: a signed URL can never replace a file that already exists.
      const { data, error } = await service.storage
        .from(bucket)
        .createSignedUploadUrl(path);
      if (error) throw new Error(`createSignedUploadUrl failed: ${error.message}`);
      return data.signedUrl;
    },

    async open(bucket, path) {
      const files = service.storage.from(bucket);
      const info = await files.info(path);
      if (info.error) {
        if (isNotFound(info.error as never)) return null;
        throw new Error(`info failed: ${info.error.message}`);
      }
      const size = info.data.size;
      if (typeof size !== "number") throw new Error("info returned no size");

      // A 60-second URL, read by our server only. The body is streamed, so
      // file-type reads only the first bytes it needs.
      const signed = await files.createSignedUrl(path, 60);
      if (signed.error) throw new Error(`createSignedUrl failed: ${signed.error.message}`);
      const response = await fetch(signed.data.signedUrl, { cache: "no-store" });
      if (response.status === 404) return null;
      if (!response.ok || !response.body) {
        throw new Error(`download failed: ${response.status}`);
      }
      return { size, stream: response.body };
    },

    async move(bucket, from, to) {
      const { error } = await service.storage.from(bucket).move(from, to);
      if (error) throw new Error(`move failed: ${error.message}`);
    },

    async remove(bucket, path) {
      const { error } = await service.storage.from(bucket).remove([path]);
      if (error) throw new Error(`remove failed: ${error.message}`);
    },
  };
}

/** The real type from the file's bytes, never from its name or header. */
export const detectMimeFromBytes: DetectMime = async (stream) =>
  (await fileTypeFromStream(stream))?.mime;
