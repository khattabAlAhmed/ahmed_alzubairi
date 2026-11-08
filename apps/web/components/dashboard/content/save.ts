import type { ContentType } from "@repo/shared";
import type { Row } from "./form-values";

export type SaveResult =
  | { ok: true; id: string | null }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; status: number; message: string | null };

/**
 * Sends a create (`POST`) or an update (`PATCH`) to the content API. The API
 * answers in the page language: it reads the locale from the referer.
 */
export async function saveContent(
  type: ContentType,
  body: Row,
  isNew: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<SaveResult> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/admin/content/${type}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, message: null };
  }
  const json = (await response.json().catch(() => null)) as {
    id?: unknown;
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    const message = json?.error?.message;
    return {
      ok: false,
      status: response.status,
      message: typeof message === "string" ? message : null,
    };
  }
  return { ok: true, id: typeof json?.id === "string" ? json.id : null };
}
