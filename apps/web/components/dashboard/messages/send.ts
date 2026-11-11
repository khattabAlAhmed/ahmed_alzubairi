export type ReadResult =
  | { ok: true }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; message: string | null };

/**
 * Marks a contact message read or unread through `PATCH /api/admin/messages`.
 * The route checks `messages.view`.
 */
export async function sendRead(
  id: string,
  read: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/admin/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, read }),
    });
  } catch {
    return { ok: false, message: null };
  }
  if (response.ok) return { ok: true };
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  const message = body?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}

/** A plain `mailto:` to the sender. Nothing but the address goes in it. */
export function replyHref(email: string): string {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`;
}
