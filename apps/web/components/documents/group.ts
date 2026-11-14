import type { DocumentAccessMode, DocumentCategory, DocumentRequestStatus } from "@repo/shared";

/** One of the client's own requests, as "وثائقي المتاحة" shows it. */
export type OwnRequest = {
  id: string;
  documentId: string;
  title: string;
  category: DocumentCategory;
  accessMode: DocumentAccessMode;
  mime: string;
  status: DocumentRequestStatus;
  consultationId: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type GroupedRequests = {
  /** Granted and not past the expiry: openable. */
  available: OwnRequest[];
  /** `pending_review` and `in_contact`. */
  inProgress: OwnRequest[];
  /** Expired or withdrawn, each with whether "طلب مجدداً" shows. */
  ended: (OwnRequest & { canRequestAgain: boolean })[];
};

/** True when the request's document can be opened now. */
export function isOpenable(request: Pick<OwnRequest, "status" | "expiresAt">, now: Date = new Date()): boolean {
  if (request.status !== "granted") return false;
  return request.expiresAt === null || Date.parse(request.expiresAt) > now.getTime();
}

/**
 * Splits the client's requests (§6.18). A grant past its expiry counts as
 * ended even before the hourly job marks it `expired`, so it leaves the
 * account on time. "طلب مجدداً" shows on an ended request only when the same
 * document has no open or available request: a second one would be merged.
 */
export function groupRequests(requests: readonly OwnRequest[], now: Date = new Date()): GroupedRequests {
  const available: OwnRequest[] = [];
  const inProgress: OwnRequest[] = [];
  const endedRows: OwnRequest[] = [];
  for (const request of requests) {
    if (isOpenable(request, now)) available.push(request);
    else if (request.status === "pending_review" || request.status === "in_contact") inProgress.push(request);
    else endedRows.push(request);
  }
  const active = new Set([...available, ...inProgress].map((request) => request.documentId));
  // One ended entry per document: the newest, since the list arrives newest first.
  const seen = new Set<string>();
  const ended = endedRows.flatMap((request) => {
    if (seen.has(request.documentId)) return [];
    seen.add(request.documentId);
    return [{ ...request, canRequestAgain: !active.has(request.documentId) }];
  });
  return { available, inProgress, ended };
}
