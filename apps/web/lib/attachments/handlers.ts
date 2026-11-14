import {
  ATTACHMENT_MIMES,
  attachmentFinalizeRequestSchema,
  attachmentUploadUrlRequestSchema,
  fileNameMatchesMime,
  MAX_ATTACHMENT_BYTES,
  uuidSchema,
  type AttachmentUploadUrlResponse,
  type FileMime,
  type Locale,
  type OkResponse,
  type SignedUrlResponse,
} from "@repo/shared";
import type { DetectMime, UploadStore } from "@/lib/admin/uploads/handlers";
import { canonicalExtension } from "@/lib/admin/uploads/keys";
import { postAccess } from "@/lib/consultations/handlers";
import type { ConsultationStore } from "@/lib/consultations/store";
import { baseFail, ownFail, type Failure, type Result } from "./errors";
import { ATTACHMENTS_BUCKET, type AttachmentStore } from "./store";

export type AttachmentDeps = {
  locale: Locale;
  /** The signed-in user from the session, or null. */
  userId: string | null;
  /** T03's consultation reads, through the user client (RLS). */
  consultations: Pick<ConsultationStore, "get" | "hasPermission">;
  attachments: AttachmentStore;
  /** Storage through the service client: lib/admin/uploads' store. */
  storage: Pick<UploadStore, "signUpload" | "open" | "remove">;
};

const typeNotAllowed = (locale: Locale) =>
  ownFail("file_type_not_allowed", 415, "fileTypeNotAllowed", locale);
const tooLarge = (locale: Locale) => ownFail("file_too_large", 413, "fileTooLarge", locale);
const consultationNotFound = (locale: Locale) =>
  ownFail("not_found", 404, "consultationNotFound", locale);
const fileNotFound = (locale: Locale) => ownFail("not_found", 404, "notFound", locale);

/** Why a declared file failed the shared schema, with a file error code where one fits. */
function declaredFileError(body: unknown, locale: Locale): Failure {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (typeof raw.mime === "string") {
    if (!(ATTACHMENT_MIMES as readonly string[]).includes(raw.mime)) return typeNotAllowed(locale);
    // A macro format such as report.docm declared as DOCX fails here.
    if (
      typeof raw.fileName === "string" &&
      raw.fileName.trim() !== "" &&
      !fileNameMatchesMime(raw.fileName.trim(), raw.mime as FileMime)
    ) {
      return typeNotAllowed(locale);
    }
  }
  if (typeof raw.sizeBytes === "number" && raw.sizeBytes > MAX_ATTACHMENT_BYTES) {
    return tooLarge(locale);
  }
  return baseFail("validation_failed", 400, locale);
}

/** The storage key of a new attachment: server-made, never from a client path. */
export function attachmentKey(consultationId: string, attachmentId: string, mime: FileMime) {
  return `${consultationId}/${attachmentId}.${canonicalExtension(mime)}`;
}

/**
 * `POST /api/consultations/:id/attachments/upload-url`. The caller must be
 * allowed to post on the consultation (T03's `postAccess`: closed refuses).
 * The declared name, type and size are checked against the shared schema, an
 * `uploading` row is written, and a one-time signed upload URL is returned.
 */
export async function createAttachmentUploadUrl(
  consultationId: string,
  body: unknown,
  deps: AttachmentDeps,
  newUuid: () => string = () => crypto.randomUUID(),
): Promise<Result<AttachmentUploadUrlResponse>> {
  const { locale, userId, consultations, attachments, storage } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);
  if (!uuidSchema.safeParse(consultationId).success) return consultationNotFound(locale);

  const consultation = await consultations.get(consultationId);
  if (!consultation) return consultationNotFound(locale);
  const access = await postAccess(consultation, userId, consultations);
  if (!access.ok) {
    return access.reason === "closed"
      ? ownFail("conflict", 409, "closed", locale)
      : ownFail("forbidden", 403, "forbidden", locale);
  }

  const parsed = attachmentUploadUrlRequestSchema.safeParse(body);
  if (!parsed.success) return declaredFileError(body, locale);

  const attachmentId = newUuid();
  const storageKey = attachmentKey(consultationId, attachmentId, parsed.data.mime);
  await attachments.insertUploading({
    id: attachmentId,
    consultationId,
    storageKey,
    fileName: parsed.data.fileName,
    mime: parsed.data.mime,
    sizeBytes: parsed.data.sizeBytes,
    uploadedBy: userId,
  });
  let url: string;
  try {
    url = await storage.signUpload(ATTACHMENTS_BUCKET, storageKey);
  } catch (error) {
    await attachments.deleteRow(attachmentId).catch(() => {});
    throw error;
  }
  return { status: 200, body: { url, attachmentId } };
}

/**
 * `POST /api/consultations/:id/attachments/finalize`, by the uploader only.
 * Checks the real size and the file's bytes (lib/admin/uploads' detection).
 * A file that fails is deleted with its row, and the answer names why. One
 * that passes becomes `ready`; T03's message route links it to a message.
 */
export async function finalizeAttachment(
  consultationId: string,
  body: unknown,
  deps: AttachmentDeps,
  detectMime: DetectMime,
): Promise<Result<OkResponse>> {
  const { locale, userId, consultations, attachments, storage } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);
  if (!uuidSchema.safeParse(consultationId).success) return consultationNotFound(locale);
  const parsed = attachmentFinalizeRequestSchema.safeParse(body);
  if (!parsed.success) return baseFail("validation_failed", 400, locale);

  if (!(await consultations.get(consultationId))) return consultationNotFound(locale);
  const { attachmentId } = parsed.data;
  const row = await attachments.pending(attachmentId);
  // Someone else's file, or one on another consultation, is "not found".
  if (!row || row.consultationId !== consultationId || row.uploadedBy !== userId) {
    return fileNotFound(locale);
  }
  if (row.status === "ready") return { status: 200, body: { ok: true } };

  const object = await storage.open(ATTACHMENTS_BUCKET, row.storageKey);
  if (!object) return ownFail("not_found", 404, "uploadMissing", locale);

  const refuse = async (failure: Failure) => {
    await object.stream.cancel().catch(() => {});
    await storage.remove(ATTACHMENTS_BUCKET, row.storageKey);
    await attachments.deleteRow(attachmentId);
    return failure;
  };

  if (object.size <= 0 || object.size > MAX_ATTACHMENT_BYTES) return refuse(tooLarge(locale));

  let realMime: string | undefined;
  try {
    realMime = await detectMime(object.stream);
  } catch {
    realMime = undefined;
  } finally {
    // The detection reads only the first bytes; stop the rest of the download.
    await object.stream.cancel().catch(() => {});
  }
  if (realMime !== row.mime) {
    return refuse(ownFail("file_type_not_allowed", 415, "fileContentMismatch", locale));
  }

  if (!(await attachments.markReady(attachmentId, object.size))) return fileNotFound(locale);
  return { status: 200, body: { ok: true } };
}

/**
 * `GET /api/attachments/:id`. The user client reads the attachment, so RLS
 * lets in only someone who sees its consultation. Then a 60-second signed URL
 * that downloads the file under its name, never inline (§9).
 */
export async function downloadAttachment(
  id: string,
  { locale, userId, attachments }: Pick<AttachmentDeps, "locale" | "userId" | "attachments">,
): Promise<Result<SignedUrlResponse>> {
  if (!userId) return baseFail("unauthenticated", 401, locale);
  if (!uuidSchema.safeParse(id).success) return fileNotFound(locale);

  const seen = await attachments.visible(id);
  if (!seen) return fileNotFound(locale);
  if (seen.status !== "ready") return ownFail("conflict", 409, "notReady", locale);

  const object = await attachments.objectOf(id);
  if (!object) return fileNotFound(locale);
  return { status: 200, body: { url: await attachments.signDownload(object.storageKey, object.fileName) } };
}
