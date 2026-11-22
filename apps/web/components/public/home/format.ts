import type { Locale } from "@repo/shared";

/*
 * How numbers read (DESIGN.md "Numbers", the Numbers board):
 * - Arabic prose uses Arabic-Indic digits (١٤ مارس ٢٠٢٥, ١٬٢٠٠, ٧٠٪); English
 *   uses Western digits. `ar` alone isn't enough: some engines (Node's ICU,
 *   for one) give Western digits for it, so the numbering system is named.
 * - Emails, phone numbers, URLs and codes are data, not prose: they stay
 *   Western and LTR (`dir="ltr"`, `mono-meta`), and never go through these.
 * - Digits that line up (tables, ledgers, stats) use tabular figures; the
 *   base styles set them on table, time, dd and output.
 */

/** The Intl locale for a page language. */
export function intlLocale(locale: Locale | string): string {
  return locale === "ar" ? "ar-u-nu-arab" : "en";
}

/**
 * A stored date or timestamp as a calendar date in the page's language.
 * Shown in UTC: the page is static, so the visitor's time zone isn't known on
 * the server, and a date-only value has no time to shift.
 */
export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

/**
 * The Intl locale for dates. English dates read day, month, year ("14 March
 * 2025", the Numbers board), which is British order; numbers stay plain `en`.
 */
export function dateLocale(locale: Locale | string): string {
  return locale === "ar" ? intlLocale(locale) : "en-GB";
}

/** A stored timestamp as a month and year: "مارس ٢٠٢٦" / "March 2026", in UTC like `formatDate`. */
export function formatMonth(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(value),
  );
}

/** A count or amount in prose: "١٬٢٠٠" / "1,200". */
export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/** A span of years with an en dash: "٢٠٢٢–٢٠٢٣" / "2022–2023". One year when they match. */
export function formatYears(start: number, end: number | null, locale: Locale): string {
  const year = (value: number) => formatNumber(value, locale, { useGrouping: false });
  if (end === null || end === start) return year(start);
  return `${year(start)}–${year(end)}`;
}

/** `wa.me` links take the international number without the `+`. */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}
