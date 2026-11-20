import { LOCALES, type Locale } from "@repo/shared";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "ar",
  // `/` always goes to Arabic, whatever the browser asks for.
  localeDetection: false,
  // No cookie: public pages stay cacheable, and the URL alone sets the language.
  localeCookie: false,
  // No `Link: …hreflang` header. The middleware builds it from the path alone,
  // so it named translations that don't exist and the other language's slug
  // wrongly. Pages and the sitemap announce the real alternates (§6.24).
  alternateLinks: false,
});

const DIRECTIONS = { ar: "rtl", en: "ltr" } as const satisfies Record<
  Locale,
  "rtl" | "ltr"
>;

export function localeDirection(locale: Locale) {
  return DIRECTIONS[locale];
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}
