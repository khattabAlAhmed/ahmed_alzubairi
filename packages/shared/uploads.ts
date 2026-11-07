import { z } from "zod";
import { uuidSchema } from "./fields";
import { MAX_ATTACHMENT_BYTES } from "./limits";

/** Allow-listed file types and their extensions (§6.17, §9). */
export const FILE_TYPES = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
} as const;

export type FileMime = keyof typeof FILE_TYPES;

const PDF: FileMime = "application/pdf";
const DOCX: FileMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX: FileMime =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const JPEG: FileMime = "image/jpeg";
const PNG: FileMime = "image/png";

/** True when the file's extension is one of the extensions of its type. */
export function fileNameMatchesMime(fileName: string, mime: FileMime): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || !fileName.includes(".")) return false;
  return (FILE_TYPES[mime] as readonly string[]).includes(extension);
}

const fileNameSchema = z.string().trim().min(1).max(255);

function fileFields(allowed: readonly FileMime[], maxBytes: number) {
  return {
    fileName: fileNameSchema,
    mime: z.enum(allowed as [FileMime, ...FileMime[]]),
    sizeBytes: z.int().positive().max(maxBytes),
  };
}

const extensionMatches = {
  check: (file: { fileName: string; mime: FileMime }) =>
    fileNameMatchesMime(file.fileName, file.mime),
  params: { path: ["fileName"] },
};

/** Consultation attachments (§6.17). */
export const ATTACHMENT_MIMES: readonly FileMime[] = [
  PDF,
  DOCX,
  XLSX,
  JPEG,
  PNG,
];

/** `POST /api/consultations/:id/attachments/upload-url` */
export const attachmentUploadUrlRequestSchema = z
  .strictObject(fileFields(ATTACHMENT_MIMES, MAX_ATTACHMENT_BYTES))
  .refine(extensionMatches.check, extensionMatches.params);

export type AttachmentUploadUrlRequest = z.infer<
  typeof attachmentUploadUrlRequestSchema
>;

export const attachmentUploadUrlResponseSchema = z.strictObject({
  url: z.url(),
  attachmentId: uuidSchema,
});

export type AttachmentUploadUrlResponse = z.infer<
  typeof attachmentUploadUrlResponseSchema
>;

/** `POST /api/consultations/:id/attachments/finalize` */
export const attachmentFinalizeRequestSchema = z.strictObject({
  attachmentId: uuidSchema,
});

export type AttachmentFinalizeRequest = z.infer<
  typeof attachmentFinalizeRequestSchema
>;

export const UPLOAD_TARGETS = [
  "document",
  "resource",
  "media",
  "letter",
] as const;

export const uploadTargetSchema = z.enum(UPLOAD_TARGETS);

export type UploadTarget = z.infer<typeof uploadTargetSchema>;

/** Where each target's files go, and what each one accepts. */
export const UPLOAD_TARGET_RULES: Record<
  UploadTarget,
  { bucket: string; mimes: readonly FileMime[]; maxBytes: number }
> = {
  document: {
    bucket: "documents",
    mimes: [PDF, JPEG, PNG],
    maxBytes: MAX_ATTACHMENT_BYTES,
  },
  resource: {
    bucket: "resources",
    mimes: [PDF, DOCX, XLSX],
    maxBytes: MAX_ATTACHMENT_BYTES,
  },
  media: {
    bucket: "public-media",
    mimes: [JPEG, PNG, PDF],
    maxBytes: MAX_ATTACHMENT_BYTES,
  },
  letter: {
    bucket: "internal",
    mimes: [PDF, JPEG, PNG],
    maxBytes: MAX_ATTACHMENT_BYTES,
  },
};

const uploadRequestFor = <Target extends UploadTarget>(target: Target) =>
  z
    .strictObject({
      target: z.literal(target),
      ...fileFields(
        UPLOAD_TARGET_RULES[target].mimes,
        UPLOAD_TARGET_RULES[target].maxBytes,
      ),
    })
    .refine(extensionMatches.check, extensionMatches.params);

/**
 * `POST /api/admin/uploads/upload-url`. The route needs `documents.manage` for
 * `document` and `content.manage` for the others.
 */
export const adminUploadUrlRequestSchema = z.union([
  uploadRequestFor("document"),
  uploadRequestFor("resource"),
  uploadRequestFor("media"),
  uploadRequestFor("letter"),
]);

export type AdminUploadUrlRequest = z.infer<typeof adminUploadUrlRequestSchema>;

export const adminUploadUrlResponseSchema = z.strictObject({
  url: z.url(),
  key: z.string().min(1),
});

export type AdminUploadUrlResponse = z.infer<
  typeof adminUploadUrlResponseSchema
>;

/** `POST /api/admin/uploads/finalize`. Same permission as `upload-url`. */
export const adminUploadFinalizeRequestSchema = z.strictObject({
  target: uploadTargetSchema,
  key: z.string().min(1),
});

export type AdminUploadFinalizeRequest = z.infer<
  typeof adminUploadFinalizeRequestSchema
>;
