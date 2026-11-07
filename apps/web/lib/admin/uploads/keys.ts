import {
  FILE_TYPES,
  UPLOAD_TARGET_RULES,
  type FileMime,
  type UploadTarget,
} from "@repo/shared";

/**
 * Unfinished uploads live under this prefix until `finalize` checks them and
 * moves them out. The hourly job deletes what is left here (Phase 3).
 */
export const PENDING_PREFIX = "pending/";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The one extension a server-made key uses for each type. */
export function canonicalExtension(mime: FileMime): string {
  return FILE_TYPES[mime][0];
}

/** A new pending key. Made on the server only, never from a client path. */
export function makePendingKey(mime: FileMime, uuid: string): string {
  return `${PENDING_PREFIX}${uuid}.${canonicalExtension(mime)}`;
}

export type ParsedPendingKey = {
  /** The type the extension stands for: the bytes must match it. */
  mime: FileMime;
  /** Where the file goes once it passes. */
  finalKey: string;
};

/**
 * Reads a pending key back, or null when it isn't one the server could have
 * made for this target: a client-chosen path, another folder, `..`, or an
 * extension the target doesn't take.
 */
export function parsePendingKey(
  target: UploadTarget,
  key: string,
): ParsedPendingKey | null {
  const match = new RegExp(`^${PENDING_PREFIX}(${UUID})\\.([a-z]+)$`).exec(key);
  if (!match) return null;
  const [, uuid, extension] = match;
  const mime = UPLOAD_TARGET_RULES[target].mimes.find(
    (allowed) => canonicalExtension(allowed) === extension,
  );
  if (!mime) return null;
  return { mime, finalKey: `${uuid}.${extension}` };
}
