"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { otherLocale } from "@/i18n/routing";

function LanguageLink({ query }: { query?: Record<string, string> }) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const target = otherLocale(locale);

  return (
    <Link
      href={{ pathname, query }}
      locale={target}
      hrefLang={target}
      lang={target}
      aria-label={t("switchLanguageLabel")}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-1 text-sm font-semibold hover:bg-text/10"
    >
      <span className="lg:hidden">{t("switchLanguageShort")}</span>
      <span className="hidden lg:inline">{t("switchLanguage")}</span>
    </Link>
  );
}

function LanguageLinkWithQuery() {
  const search = useSearchParams();

  return <LanguageLink query={Object.fromEntries(search)} />;
}

/** Keeps the query too, or switching language on sign-in would lose the return path. */
export function LanguageSwitch() {
  return (
    <Suspense fallback={<LanguageLink />}>
      <LanguageLinkWithQuery />
    </Suspense>
  );
}
