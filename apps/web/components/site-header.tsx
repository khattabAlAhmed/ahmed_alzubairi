import { useTranslations } from "next-intl";
import { ConsultationButton } from "./consultation-button";
import { LanguageSwitch } from "./language-switch";
import { MobileMenu } from "./mobile-menu";
import { MAIN_NAV } from "./nav-items";
import { NavLink } from "./nav-link";
import { SiteLogo } from "./site-logo";
import { ThemeSwitch } from "./theme-switch";

export function SiteHeader() {
  const t = useTranslations("Nav");

  return (
    <header className="relative z-40 border-b border-text/10 bg-surface">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        <SiteLogo />
        <nav aria-label={t("mainLabel")} className="ms-4 hidden xl:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="rounded-md px-2 py-2 text-sm whitespace-nowrap hover:bg-text/10 aria-[current=page]:font-semibold"
                >
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {/* On phones the button takes its own row, so it never squeezes the logo. */}
        <ConsultationButton className="order-last w-full justify-center sm:order-none sm:ms-auto sm:w-auto" />
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:ms-0">
          <LanguageSwitch />
          <ThemeSwitch />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
