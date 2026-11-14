import { notificationCounterSchema } from "@repo/shared";

export type ReadResult =
  | { ok: true; unread: number }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; message: string | null };

/**
 * Marks the caller's notifications read through `POST /api/notifications/read`:
 * the given ids, or all of them when `ids` is left out. `keepalive` lets the
 * request finish while the browser leaves the page.
 */
export async function sendRead(
  ids?: readonly string[],
  { keepalive = false, fetchImpl = fetch }: { keepalive?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<ReadResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
      keepalive,
    });
  } catch {
    return { ok: false, message: null };
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const counter = notificationCounterSchema.safeParse(body);
    return counter.success
      ? { ok: true, unread: counter.data.unread }
      : { ok: false, message: null };
  }
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}
