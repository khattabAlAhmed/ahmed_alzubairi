import type { DisableAccountResponse, UpdateProfileRequest } from "@repo/shared";

export type SendResult<T = unknown> =
  | { ok: true; body: T }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; message: string | null };

async function send<T>(
  url: string,
  method: "PATCH" | "POST",
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<SendResult<T>> {
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
  const reply = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: unknown } })
    | null;
  if (response.ok) return { ok: true, body: reply as T };
  const message = reply?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}

/** `PATCH /api/profile`: the caller's own details. */
export function saveProfile(body: UpdateProfileRequest, fetchImpl: typeof fetch = fetch) {
  return send("/api/profile", "PATCH", body, fetchImpl);
}

/** `POST /api/account/disable`: the caller's own account. */
export function disableOwnAccount(fetchImpl: typeof fetch = fetch) {
  return send<DisableAccountResponse>("/api/account/disable", "POST", {}, fetchImpl);
}
