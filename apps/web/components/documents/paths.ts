import { DOCUMENT_REQUEST_STATUSES, uuidSchema, type DocumentRequestStatus } from "@repo/shared";

/** The public list (§6.12), where requests start. */
export const DOCUMENTS_PATH = "/documents";

/** "وثائقي المتاحة". */
export const MY_DOCUMENTS_PATH = "/account/documents";

/**
 * The selection carried through sign-in: `?request=<id>,<id>`. The documents
 * page reads it back, selects those documents and opens the dialog.
 */
export const REQUEST_PARAM = "request";

/** The most ids one link carries; a longer list is cut, never refused. */
export const MAX_REQUEST_IDS = 50;

/** The document ids in a `request` value: uuids only, each once, in order. */
export function parseRequestIds(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => uuidSchema.safeParse(part).success);
  return [...new Set(ids)].slice(0, MAX_REQUEST_IDS);
}

/** The documents page with these documents selected, as a path with its query (no locale). */
export function requestPath(ids: readonly string[]): string {
  if (ids.length === 0) return DOCUMENTS_PATH;
  return `${DOCUMENTS_PATH}?${REQUEST_PARAM}=${ids.join(",")}`;
}

/** The viewer for one granted request. */
export function viewerPath(requestId: string): string {
  return `${MY_DOCUMENTS_PATH}/${encodeURIComponent(requestId)}`;
}

/** The client's chat for a request in contact (§6.18 "التواصل أولاً"). */
export function chatPath(consultationId: string): string {
  return `/account/consultations/${encodeURIComponent(consultationId)}`;
}

export function isRequestStatus(value: string): value is DocumentRequestStatus {
  return (DOCUMENT_REQUEST_STATUSES as readonly string[]).includes(value);
}
