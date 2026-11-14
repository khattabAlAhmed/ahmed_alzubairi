import type { CreateDocumentRequestResponse, DocumentOpenAction, DocumentOpenResponse } from "@repo/shared";

export type ApiResult<Body> =
  | { ok: true; body: Body }
  /** `message` is the server's localized text, `code` its error code, when it sent them. */
  | { ok: false; status: number; code: string | null; message: string | null };

async function call<Body>(url: string, init: RequestInit, fetchImpl: typeof fetch): Promise<ApiResult<Body>> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    return { ok: false, status: 0, code: null, message: null };
  }
  const reply = (await response.json().catch(() => null)) as unknown;
  if (response.ok) return { ok: true, body: reply as Body };
  const error = (reply as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return {
    ok: false,
    status: response.status,
    code: typeof error?.code === "string" ? error.code : null,
    message: typeof error?.message === "string" ? error.message : null,
  };
}

/**
 * `POST /api/document-requests`. A duplicate is merged into the open or
 * granted request (§6.22) and comes back as a success, like a new one.
 */
export function sendDocumentRequest(
  documentIds: readonly string[],
  purpose: string,
  fetchImpl: typeof fetch = fetch,
) {
  return call<CreateDocumentRequestResponse>(
    "/api/document-requests",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds, purpose }),
    },
    fetchImpl,
  );
}

/**
 * `GET /api/documents/:id/open`: the grant is checked, the open is logged, and
 * a watermarked copy comes back as a signed URL that lasts 60 seconds.
 */
export function openDocument(
  documentId: string,
  action: DocumentOpenAction = "view",
  fetchImpl: typeof fetch = fetch,
) {
  const query = action === "download" ? "?action=download" : "";
  return call<DocumentOpenResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/open${query}`,
    { method: "GET", cache: "no-store" },
    fetchImpl,
  );
}

/** The signed URL with Storage's `download` flag, so the browser saves the file under this name. */
export function downloadUrl(url: string, fileName: string): string {
  const next = new URL(url);
  next.searchParams.set("download", fileName);
  return next.toString();
}
