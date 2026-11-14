import {
  documentOpenQuerySchema,
  SIGNED_URL_TTL_SECONDS,
  uuidSchema,
  type DocumentAccessMode,
  type DocumentOpenAction,
  type DocumentOpenResponse,
  type ErrorResponse,
  type Locale,
} from "@repo/shared";
import type { AuditEntry } from "@/lib/admin/audit";
import { baseError } from "@/lib/admin/permissions";
import type { StampableMime } from "@/lib/watermark/stamp";
import ar from "@/messages/ar/DocumentOpenErrors.json";
import en from "@/messages/en/DocumentOpenErrors.json";

const MESSAGES = { ar, en };

type ErrorResult = { status: number; body: ErrorResponse };

function openError(
  code: "not_found" | "forbidden",
  status: number,
  key: keyof typeof en,
  locale: Locale,
): ErrorResult {
  return { status, body: { error: { code, message: MESSAGES[locale][key] } } };
}

/** The viewer, read through their own client: their name goes in the mark. */
export type Viewer = { fullName: string; locale: Locale; timeZone: string };

/** The document, read with the service client after the access check. */
export type StoredDocument = {
  storageKey: string;
  mime: StampableMime;
  accessMode: DocumentAccessMode;
  titleAr: string;
  titleEn: string;
};

/**
 * The reads and writes the open route makes. The access reads go through the
 * caller's own client (RLS); the rest through the service client, only after
 * the caller's access is settled.
 */
export type DocumentOpenStore = {
  viewer: () => Promise<Viewer | null>;
  /** `has_permission('documents.view')` for the caller, through RLS. */
  isTeamViewer: () => Promise<boolean>;
  /** The caller's live grant for this document: granted, not expired. Its id, or null. */
  liveGrant: (documentId: string) => Promise<string | null>;
  document: (documentId: string) => Promise<StoredDocument | null>;
  logAccess: (row: { requestId: string; documentId: string; action: DocumentOpenAction }) => Promise<void>;
  /**
   * The original's bytes, or null when the `documents` bucket has no object
   * at that key (an operational fault, not a crash). Never sent to the browser.
   */
  readOriginal: (storageKey: string) => Promise<Uint8Array | null>;
  /** Saves a watermarked copy in `document-views` under a new random key. Returns the key. */
  saveCopy: (bytes: Uint8Array, mime: StampableMime) => Promise<string>;
  /** A signed URL for a copy, valid `SIGNED_URL_TTL_SECONDS`. */
  signCopy: (key: string, downloadAs: string | null) => Promise<string>;
};

export type DocumentOpenDeps = {
  locale: Locale;
  userId: string;
  store: DocumentOpenStore;
  audit: (entry: AuditEntry) => Promise<void>;
  /** The watermark: the tile for these words, stamped on the original. */
  watermark: (original: Uint8Array, mime: StampableMime, text: string) => Promise<Uint8Array>;
  /** The mark's words for this viewer and moment. */
  markText: (viewer: Viewer, at: Date) => string;
  now: () => Date;
};

const EXTENSIONS: Record<StampableMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** A file name for a download: the title in the viewer's language, nothing a header can trip on. */
export function downloadName(document: StoredDocument, locale: Locale): string {
  const title = (locale === "ar" ? document.titleAr : document.titleEn)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${title || "document"}.${EXTENSIONS[document.mime]}`;
}

/**
 * `GET /api/documents/:id/open?action=view|download`, after the session check
 * (§6.18 "Opening a document", §9 Protected documents):
 *   1. Access: a client needs a live grant for this document; a team member
 *      with `documents.view` may open any document. Anyone else: 404, with
 *      nothing logged.
 *   2. `download` on a view-only document: 403.
 *   3. The open is written (`document_access_log` for a client's grant, and
 *      `audit_log` for everyone) before any copy exists.
 *   4. A watermarked copy goes to `document-views`; the answer is a signed URL
 *      to it, valid 60 seconds. The original is never sent.
 *   5. An original missing from Storage: 404 with its own message, and a log
 *      line naming the document id only. The open was already logged in step
 *      3 (the log comes before any copy, by design), and no copy is made.
 */
export async function openDocument(
  rawId: unknown,
  rawQuery: Record<string, string>,
  deps: DocumentOpenDeps,
): Promise<{ status: 200; body: DocumentOpenResponse } | ErrorResult> {
  const id = uuidSchema.safeParse(rawId);
  const query = documentOpenQuerySchema.safeParse(rawQuery);
  if (!id.success || !query.success) return baseError("validation_failed", 400, deps.locale);
  const documentId = id.data;
  const { action } = query.data;
  const { store, locale } = deps;

  const notFound = () => openError("not_found", 404, "notFound", locale);

  const [viewer, isTeam] = await Promise.all([store.viewer(), store.isTeamViewer()]);
  if (!viewer) return notFound();
  const grantId = isTeam ? null : await store.liveGrant(documentId);
  if (!isTeam && !grantId) return notFound();

  const document = await store.document(documentId);
  if (!document) return notFound();
  if (action === "download" && document.accessMode === "view") {
    return openError("forbidden", 403, "downloadNotAllowed", locale);
  }

  if (grantId) {
    await store.logAccess({ requestId: grantId, documentId, action });
  }
  await deps.audit({
    actorId: deps.userId,
    action: action === "download" ? "document.download" : "document.view",
    entity: "documents",
    entityId: documentId,
    metadata: grantId ? { requestId: grantId } : { team: true },
  });

  const original = await store.readOriginal(document.storageKey);
  if (!original) {
    // The id only: no key, no name, nothing about the viewer.
    console.error(`GET /api/documents/:id/open original missing for document ${documentId}`);
    return openError("not_found", 404, "originalMissing", locale);
  }
  const stamped = await deps.watermark(original, document.mime, deps.markText(viewer, deps.now()));
  const copyKey = await store.saveCopy(stamped, document.mime);
  const url = await store.signCopy(
    copyKey,
    action === "download" ? downloadName(document, viewer.locale) : null,
  );

  return {
    status: 200,
    body: { url, expiresInSeconds: SIGNED_URL_TTL_SECONDS, accessMode: document.accessMode },
  };
}
