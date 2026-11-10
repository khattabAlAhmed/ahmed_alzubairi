import type { Locale } from "@repo/shared";

/**
 * The languages as one phrase inside a sentence, named in the UI language:
 * "Arabic and English" in en, "العربية والإنجليزية" in ar. A label that stands
 * alone (a tab, a badge) keeps each language's own name instead.
 */
export function languageList(uiLocale: Locale, locales: readonly Locale[]): string {
  const names = new Intl.DisplayNames(uiLocale, { type: "language" });
  return new Intl.ListFormat(uiLocale, { type: "conjunction" }).format(
    locales.map((locale) => names.of(locale) ?? locale),
  );
}
