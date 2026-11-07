"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { otherLocale } from "@/i18n/routing";

export function LanguageSwitch() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();
  const target = otherLocale(locale);

  return (
    <Link
      href={pathname}
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
