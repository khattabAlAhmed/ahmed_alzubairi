import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FOOTER_NAV } from "./nav-items";
import { SiteLogo } from "./site-logo";

const LINK = "text-sm text-text-secondary hover:text-text";

export function SiteFooter() {
  const t = useTranslations("Footer");
  const tNav = useTranslations("Nav");

  return (
    <footer className="mt-auto border-t border-text/10 bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
        <SiteLogo />
        <nav aria-label={t("sectionsLabel")}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={LINK}>
                  {tNav(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav
          aria-label={t("legalLabel")}
          className="border-t border-text/10 pt-4"
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/privacy" className={LINK}>
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={LINK}>
                {t("terms")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
