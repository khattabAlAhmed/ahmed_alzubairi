import {
  ATTACHMENT_MIMES,
  FILE_TYPES,
  fileNameMatchesMime,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type FileMime,
} from "@repo/shared";

/** Why a file is refused before or during upload (§6.17). */
export type RefusalReason = "tooLarge" | "wrongType" | "tooMany" | "failed";

export type FileKind = "pdf" | "docx" | "xlsx" | "image" | "other";

// A Map, so an inherited key such as "toString" or "__proto__" can't match.
const KIND_BY_MIME = new Map<string, FileKind>([
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["image/jpeg", "image"],
  ["image/png", "image"],
] satisfies [FileMime, FileKind][]);

/** The icon and label group for a file. An unknown type is "other". */
export function fileKind(mime: string): FileKind {
  return KIND_BY_MIME.get(mime) ?? "other";
}

/** "2.4 MB" / "2.4 ميغابايت". Arabic uses the long unit: the short one ("م.ب") isn't widely read. */
export function formatBytes(bytes: number, locale: string): string {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: mb ? "megabyte" : "kilobyte",
    unitDisplay: locale === "ar" ? "long" : "short",
    maximumFractionDigits: mb ? 1 : 0,
  }).format(mb ? bytes / (1024 * 1024) : Math.max(1, Math.round(bytes / 1024)));
}

/** The first extension of each allowed type, as the limit line names them: PDF, DOCX, XLSX, JPG, PNG. */
export function allowedTypeNames(): string[] {
  return ATTACHMENT_MIMES.map((mime) => FILE_TYPES[mime][0].toUpperCase());
}

/** What the file input accepts: every allowed type and its extensions. */
export function attachmentAccept(): string {
  return ATTACHMENT_MIMES.flatMap((mime) => [mime, ...FILE_TYPES[mime].map((ext) => `.${ext}`)]).join(",");
}

/** A list joined with the locale's comma. Intl.ListFormat puts و before Latin names in Arabic, which reads badly here. */
export function joinList(items: string[], locale: string): string {
  return items.join(locale === "ar" ? "، " : ", ");
}

/**
 * The reason a picked file is refused before upload, or null when it may go
 * up. `alreadyAttached` counts the files already on the message. The server
 * checks again; this only spares the member a pointless upload.
 */
export function attachmentRefusal(
  file: { name: string; size: number; type: string },
  alreadyAttached: number,
): RefusalReason | null {
  if (alreadyAttached >= MAX_ATTACHMENTS_PER_MESSAGE) return "tooMany";
  const mime = ATTACHMENT_MIMES.find((allowed) => allowed === file.type);
  if (!mime || !fileNameMatchesMime(file.name, mime)) return "wrongType";
  if (file.size > MAX_ATTACHMENT_BYTES) return "tooLarge";
  return null;
}

/** The named part of a zone, such as "GMT+3" (short) or "Arabian Standard Time" (long). */
export function zoneName(
  value: Date,
  locale: string,
  style: "short" | "longGeneric",
  timeZone?: string,
): string {
  return (
    new Intl.DateTimeFormat(locale, { timeZoneName: style, timeZone })
      .formatToParts(value)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}
