import { UPLOAD_TARGET_RULES, type FileMime } from "@repo/shared";
import { canonicalExtension } from "../uploads/keys";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FINAL_KEY = new RegExp(`^(${UUID})\\.([a-z]+)$`);

/**
 * The type a finished document key stands for, or null when the key isn't one
 * `uploads/finalize` makes for the `document` target: a pending key, a path
 * with folders or `..`, or an extension the target doesn't take (a DOCX from
 * an attachment, say). Whether the file is really in the `documents` bucket is
 * checked separately.
 */
export function documentKeyMime(key: string): FileMime | null {
  const match = FINAL_KEY.exec(key);
  if (!match) return null;
  const extension = match[2];
  return (
    UPLOAD_TARGET_RULES.document.mimes.find(
      (mime) => canonicalExtension(mime) === extension,
    ) ?? null
  );
}

/** The bucket the documents' originals live in (§7). */
export const DOCUMENTS_BUCKET = UPLOAD_TARGET_RULES.document.bucket;
