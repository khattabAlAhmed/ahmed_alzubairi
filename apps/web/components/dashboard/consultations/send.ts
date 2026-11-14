import type { CreateMeetingRequest, UpdateConsultationRequest, UpdateMeetingRequest } from "@repo/shared";

export type SendResult = { ok: true } | { ok: false; message: string | null };

async function send(method: string, url: string, body: unknown, fetchImpl: typeof fetch): Promise<SendResult> {
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
  if (response.ok) return { ok: true };
  const reply = (await response.json().catch(() => null)) as { error?: { message?: unknown } } | null;
  const message = reply?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}

const base = (id: string) => `/api/admin/consultations/${encodeURIComponent(id)}`;

/** `PATCH /api/admin/consultations/:id`: status (reply rights) or assignee (`consultations.assign`). */
export function updateConsultation(id: string, body: UpdateConsultationRequest, fetchImpl: typeof fetch = fetch) {
  return send("PATCH", base(id), body, fetchImpl);
}

/** `POST /api/admin/consultations/:id/meetings` */
export function createMeeting(id: string, body: CreateMeetingRequest, fetchImpl: typeof fetch = fetch) {
  return send("POST", `${base(id)}/meetings`, body, fetchImpl);
}

/** `PATCH /api/admin/consultations/:id/meetings` */
export function updateMeeting(id: string, body: UpdateMeetingRequest, fetchImpl: typeof fetch = fetch) {
  return send("PATCH", `${base(id)}/meetings`, body, fetchImpl);
}

/** `DELETE /api/admin/consultations/:id` (`data.delete`), with the id again as the confirmation (§8). */
export function deleteConsultation(id: string, fetchImpl: typeof fetch = fetch) {
  return send("DELETE", base(id), { confirm: id }, fetchImpl);
}
