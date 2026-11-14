import type { DecideDocumentRequest, RecommendDocumentRequest } from "@repo/shared";
import { sendJson } from "@/components/dashboard/documents/send";

const base = (id: string) => `/api/admin/document-requests/${encodeURIComponent(id)}`;

/** `POST …/recommend` (`document_requests.recommend`). */
export function sendRecommendation(id: string, body: RecommendDocumentRequest, fetchImpl?: typeof fetch) {
  return sendJson("POST", `${base(id)}/recommend`, body, fetchImpl);
}

/** `POST …/decide` (`document_requests.decide`): grant, contact_first or withdraw. Never a reject. */
export function sendDecision(id: string, body: DecideDocumentRequest, fetchImpl?: typeof fetch) {
  return sendJson("POST", `${base(id)}/decide`, body, fetchImpl);
}

/**
 * The end of the picked day in the browser's own zone, as UTC, or null when
 * that moment has already passed. `date` is the `YYYY-MM-DD` of a date input.
 */
export function expiryFromDate(date: string, now: Date = new Date()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return null;
  return end.toISOString();
}
