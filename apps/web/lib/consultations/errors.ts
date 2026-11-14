import type { ErrorCode, ErrorResponse, Locale } from "@repo/shared";
import ownAr from "@/messages/ar/ConsultationErrors.json";
import ar from "@/messages/ar.json";
import ownEn from "@/messages/en/ConsultationErrors.json";
import en from "@/messages/en.json";

const BASE = { ar: ar.Errors, en: en.Errors };
const OWN = { ar: ownAr, en: ownEn };

/** A route's answer: its status and body. */
export type Result<T> = { status: number; body: T | ErrorResponse };

export type Failure = { status: number; body: ErrorResponse };

/** An error whose text is in the base `Errors` messages. */
export function baseFail(
  code: "unauthenticated" | "validation_failed" | "internal_error",
  status: number,
  locale: Locale,
): Failure {
  return { status, body: { error: { code, message: BASE[locale][code] } } };
}

/** An error whose text is in the `ConsultationErrors` namespace. */
export function ownFail(
  code: ErrorCode,
  status: number,
  key: keyof typeof ownEn,
  locale: Locale,
): Failure {
  return { status, body: { error: { code, message: OWN[locale][key] } } };
}
