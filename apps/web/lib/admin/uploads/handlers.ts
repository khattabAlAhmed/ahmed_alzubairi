import {
  adminUploadFinalizeRequestSchema,
  adminUploadUrlRequestSchema,
  fileNameMatchesMime,
  PERMISSIONS,
  UPLOAD_TARGET_RULES,
  uploadTargetSchema,
  type AdminUploadUrlResponse,
  type FileMime,
  type Locale,
  type Permission,
  type UploadTarget,
} from "@repo/shared";
import { adminError, baseError, type AdminError } from "../permissions";
import { makePendingKey, parsePendingKey } from "./keys";

/** The Storage calls the upload routes make, all through the service client. */
export type UploadStore = {
  /** A one-time signed upload URL for a path that doesn't exist yet. */
  signUpload: (bucket: string, path: string) => Promise<string>;
  /** The object's real size and a stream of its bytes, or null if missing. */
  open: (
    bucket: string,
    path: string,
  ) => Promise<{ size: number; stream: ReadableStream<Uint8Array> } | null>;
  move: (bucket: string, from: string, to: string) => Promise<void>;
  remove: (bucket: string, path: string) => Promise<void>;
};

/** Reads the first bytes of a stream and names the real type, if known. */
export type DetectMime = (
  stream: ReadableStream<Uint8Array>,
) => Promise<string | undefined>;

export type UploadHandlerDeps = {
  locale: Locale;
  store: UploadStore;
};

type Ok<Body> = { status: 200; body: Body };
type Result<Body> = Ok<Body> | AdminError;

/** `documents.manage` for `document`, `content.manage` for the others (§8). */
export function permissionForTarget(target: UploadTarget): Permission {
  return target === "document"
    ? PERMISSIONS.DOCUMENTS_MANAGE
    : PERMISSIONS.CONTENT_MANAGE;
}

/**
 * The permission a raw body needs. A body without a valid target still needs
 * a team permission before it is told why it failed.
 */
export function permissionForBody(body: unknown): Permission {
  const target = uploadTargetSchema.safeParse(
    (body as { target?: unknown } | null | undefined)?.target,
  );
  return target.success
    ? permissionForTarget(target.data)
    : PERMISSIONS.CONTENT_MANAGE;
}

const typeNotAllowed = (locale: Locale) =>
  adminError("file_type_not_allowed", 415, "fileTypeNotAllowed", locale);
const tooLarge = (locale: Locale) =>
  adminError("file_too_large", 413, "fileTooLarge", locale);

/** Names why a declared file failed, with a file error code where one fits. */
function declaredFileError(body: unknown, locale: Locale): AdminError {
  const raw = (body ?? {}) as Record<string, unknown>;
  const target = uploadTargetSchema.safeParse(raw.target);
  if (!target.success) return baseError("validation_failed", 400, locale);
  const rules = UPLOAD_TARGET_RULES[target.data];

  if (typeof raw.mime === "string") {
    if (!(rules.mimes as readonly string[]).includes(raw.mime)) {
      return typeNotAllowed(locale);
    }
    if (
      typeof raw.fileName === "string" &&
      raw.fileName.trim() !== "" &&
      !fileNameMatchesMime(raw.fileName.trim(), raw.mime as FileMime)
    ) {
      return typeNotAllowed(locale);
    }
  }
  if (typeof raw.sizeBytes === "number" && raw.sizeBytes > rules.maxBytes) {
    return tooLarge(locale);
  }
  return baseError("validation_failed", 400, locale);
}

/**
 * `POST /api/admin/uploads/upload-url`, after the permission check. Checks the
 * declared name, type and size, then signs a key the server made.
 */
export async function createUploadUrl(
  body: unknown,
  { locale, store }: UploadHandlerDeps,
  newUuid: () => string = () => crypto.randomUUID(),
): Promise<Result<AdminUploadUrlResponse>> {
  const parsed = adminUploadUrlRequestSchema.safeParse(body);
  if (!parsed.success) return declaredFileError(body, locale);

  const { target, mime } = parsed.data;
  const key = makePendingKey(mime, newUuid());
  const url = await store.signUpload(UPLOAD_TARGET_RULES[target].bucket, key);
  return { status: 200, body: { url, key } };
}

/**
 * `POST /api/admin/uploads/finalize`, after the permission check. Checks the
 * real size and bytes. A file that fails is deleted; one that passes moves out
 * of `pending/`, and its new key is what content and document bodies carry.
 */
export async function finalizeUpload(
  body: unknown,
  { locale, store }: UploadHandlerDeps,
  detectMime: DetectMime,
): Promise<Result<{ key: string }>> {
  const parsed = adminUploadFinalizeRequestSchema.safeParse(body);
  if (!parsed.success) return baseError("validation_failed", 400, locale);

  const { target, key } = parsed.data;
  // Only a key this server made for this target. Never a client path.
  const pending = parsePendingKey(target, key);
  if (!pending) return baseError("validation_failed", 400, locale);

  const rules = UPLOAD_TARGET_RULES[target];
  const object = await store.open(rules.bucket, key);
  if (!object) {
    return adminError("not_found", 404, "uploadNotFound", locale);
  }

  const refuse = async (error: AdminError) => {
    await object.stream.cancel().catch(() => {});
    await store.remove(rules.bucket, key);
    return error;
  };

  if (object.size <= 0 || object.size > rules.maxBytes) {
    return refuse(tooLarge(locale));
  }

  let realMime: string | undefined;
  try {
    realMime = await detectMime(object.stream);
  } catch {
    realMime = undefined;
  } finally {
    // file-type reads only the first bytes; stop the rest of the download.
    await object.stream.cancel().catch(() => {});
  }
  if (realMime !== pending.mime) return refuse(typeNotAllowed(locale));

  await store.move(rules.bucket, key, pending.finalKey);
  return { status: 200, body: { key: pending.finalKey } };
}
