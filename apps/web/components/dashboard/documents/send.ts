import {
  UPLOAD_TARGET_RULES,
  type CreateDocument,
  type FileMime,
  type UpdateDocument,
} from "@repo/shared";

export type SendResult<Body = unknown> =
  | { ok: true; body: Body }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; message: string | null };

/** One JSON call to an admin route. The route checks the permission. */
export async function sendJson<Body = unknown>(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult<Body>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: null };
  }
  const reply = (await response.json().catch(() => null)) as unknown;
  if (response.ok) return { ok: true, body: reply as Body };
  const message = (reply as { error?: { message?: unknown } } | null)?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}

/** `POST /api/admin/documents` (`documents.manage`). */
export function createDocument(body: CreateDocument, fetchImpl?: typeof fetch) {
  return sendJson<{ id: string }>("POST", "/api/admin/documents", body, fetchImpl);
}

/** `PATCH /api/admin/documents` (`documents.manage`). */
export function updateDocument(body: UpdateDocument, fetchImpl?: typeof fetch) {
  return sendJson("PATCH", "/api/admin/documents", body, fetchImpl);
}

/**
 * `DELETE /api/admin/documents/:id` (`data.delete`), with the row id again in
 * the body as the route's confirmation (§8).
 */
export function deleteDocument(id: string, fetchImpl?: typeof fetch) {
  return sendJson("DELETE", `/api/admin/documents/${encodeURIComponent(id)}`, { confirm: id }, fetchImpl);
}

const RULES = UPLOAD_TARGET_RULES.document;

/** What the picker offers: the `document` target's types. */
export const DOCUMENT_ACCEPT = RULES.mimes.join(",");

export const DOCUMENT_MAX_BYTES = RULES.maxBytes;

/** Why a picked file can't be a document, or null when it can. The server checks again. */
export function fileProblem(file: File): "fileType" | "fileSize" | null {
  if (!(RULES.mimes as readonly string[]).includes(file.type as FileMime)) return "fileType";
  if (file.size > RULES.maxBytes) return "fileSize";
  return null;
}

/** PDF, JPG or PNG, from the stored type. */
export function fileTypeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  return mime;
}
