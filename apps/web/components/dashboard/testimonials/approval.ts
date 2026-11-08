import type { TrustType } from "./rows";

export type ApprovalResult =
  | { ok: true }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; message: string | null };

/**
 * Gives or withdraws the admin's approval through
 * `PATCH /api/admin/{testimonials,partners}/:id/approve`. The route checks
 * `testimonials.approve` and sets `approved_by` from the session; withdrawing
 * also drafts the row.
 */
export async function sendApproval(
  type: TrustType,
  id: string,
  approved: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<ApprovalResult> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/admin/${type}/${encodeURIComponent(id)}/approve`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved }),
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
