import { LOCALES, type Locale } from "@repo/shared";

/** The page's locale. `requireProfile` has already sent unknown ones to "not found". */
export function pageLocale(value: string): Locale {
  return LOCALES.find((item) => item === value) ?? "ar";
}
