import type { ErrorCode, ErrorResponse, Locale } from "@repo/shared";
import ar from "@/messages/ar/DocumentRequestErrors.json";
import en from "@/messages/en/DocumentRequestErrors.json";

const MESSAGES = { ar, en };

export type DocumentRequestMessageKey = keyof typeof en;

/** An error a document-request route answers with. */
export type RouteError = { status: number; body: ErrorResponse };

export function requestError(
  code: ErrorCode,
  status: number,
  key: DocumentRequestMessageKey,
  locale: Locale,
): RouteError {
  return { status, body: { error: { code, message: MESSAGES[locale][key] } } };
}

/**
 * The document functions raise a fixed message with a SQLSTATE (see the
 * migration `20261114083000_document_functions.sql`). Each known one maps to
 * a status and the user's text; anything else is unexpected and returns null,
 * so the route answers 500.
 */
const SQL_ERRORS: Record<string, { code: ErrorCode; status: number; key: DocumentRequestMessageKey }> = {
  not_a_client: { code: "forbidden", status: 403, key: "notAClient" },
  not_allowed: { code: "forbidden", status: 403, key: "notAllowed" },
  document_unavailable: { code: "not_found", status: 404, key: "documentUnavailable" },
  request_not_found: { code: "not_found", status: 404, key: "requestNotFound" },
  request_not_open: { code: "conflict", status: 409, key: "requestNotOpen" },
  request_not_granted: { code: "conflict", status: 409, key: "requestNotGranted" },
  expiry_in_past: { code: "validation_failed", status: 400, key: "expiryInPast" },
};

/** A function error as the route's answer, or null when it isn't a known one. */
export function fromSqlError(
  error: { code?: string; message?: string } | null | undefined,
  locale: Locale,
): RouteError | null {
  const known = error?.message ? SQL_ERRORS[error.message] : undefined;
  return known ? requestError(known.code, known.status, known.key, locale) : null;
}

/** Thrown by the store for a known function error, carrying the route's answer. */
export class DocumentRequestError extends Error {
  constructor(readonly answer: RouteError) {
    super(`document request refused (${answer.status})`);
  }
}
