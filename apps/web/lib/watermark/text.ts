import type { Locale } from "@repo/shared";
import { formatDateTime } from "@/lib/time/format";

/**
 * The watermark's words (§6.18): the viewer's full name and the view date in
 * their language and time zone, e.g. "سارة أحمد · ١٤ نوفمبر ٢٠٢٦" or
 * "Sara Ahmed · 14 November 2026". Arabic-Indic digits in Arabic: the bundled
 * IBM Plex Sans Arabic draws them (DESIGN.md "Numbers").
 */
export function watermarkText(
  fullName: string,
  viewedAt: Date,
  locale: Locale,
  timeZone: string,
): string {
  let date: string;
  try {
    date = formatDateTime(viewedAt, locale, { date: "long", time: false, timeZone });
  } catch {
    // An unknown zone on an old profile: the date in UTC rather than no mark.
    date = formatDateTime(viewedAt, locale, { date: "long", time: false, timeZone: "UTC" });
  }
  return `${fullName.trim()} · ${date}`;
}

const STRONG_RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const STRONG_LTR = /[A-Za-zÀ-ɏ]/;

/**
 * The text's base direction, from its first strong character, as the
 * browser's `dir="auto"` decides it. A mixed "Sara سارة" stays left to right;
 * "سارة Sara" right to left.
 */
export function baseDirection(text: string): "rtl" | "ltr" {
  for (const char of text) {
    if (STRONG_RTL.test(char)) return "rtl";
    if (STRONG_LTR.test(char)) return "ltr";
  }
  return "ltr";
}
