import type { Locale } from "@repo/shared";

/**
 * A stored date or timestamp as a calendar date in the page's language.
 * Shown in UTC: the page is static, so the visitor's time zone isn't known on
 * the server, and a date-only value has no time to shift.
 */
export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

/** `wa.me` links take the international number without the `+`. */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}
