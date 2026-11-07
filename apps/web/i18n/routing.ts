import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // `/` always goes to Arabic, whatever the browser asks for.
  localeDetection: false,
  // No cookie: public pages stay cacheable, and the URL alone sets the language.
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];

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
