import { useTranslations } from "next-intl";
import { connection } from "next/server";
import { Suspense } from "react";
import { whatsappHref } from "@/components/public/home/format";
import { CONTAINER } from "@/components/public/parts";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { getSiteSettings } from "@/lib/content";
import { AuthLink } from "./auth-link";
import { ConsultationButton } from "./consultation-button";
import { LanguageSwitch } from "./language-switch";
import { MobileMenu } from "./mobile-menu";
import { MAIN_NAV } from "./nav-items";
import { NavLink } from "./nav-link";
import { QuickContact as QuickContactTab } from "./quick-contact";
import { SiteLogo } from "./site-logo";
import { ThemeSwitch } from "./theme-switch";

/**
 * WhatsApp and email from site settings, always within reach (§6.1), as the
 * QuickContact tab. It renders on request inside a Suspense boundary, so the
 * header's shell stays static and the build never reads Supabase. It reads no
 * session.
 */
export async function QuickContact() {
  await connection();
  let settings;
  try {
    settings = await getSiteSettings();
  } catch (error) {
    // Quick contact is extra: a failed read must not take the page down.
    console.error("quick contact: site settings failed", error);
    return null;
  }
  return (
    <QuickContactTab
      whatsapp={settings.whatsappNumber ? { number: settings.whatsappNumber, href: whatsappHref(settings.whatsappNumber) } : null}
      email={settings.contactEmail ?? null}
    />
  );
}

/**
 * The public header (the Header board): his name and fields on the start side,
 * the sections, then the language, the theme, sign-in and «اطلب استشارة» on
 * the end side. It stays at the top while the page scrolls, opened by the 2px
 * rule. On phones it keeps only his name, the consultation button and the
 * menu; the rest moves into the menu.
 */
export function SiteHeader() {
  return (
    <>
      <HeaderBar className="sticky top-0 z-40" />
      <Suspense>
        <QuickContact />
      </Suspense>
    </>
  );
}

/** The header's bar alone, without the quick-contact tab: the design-system page shows it in place. */
export function HeaderBar({ className }: { className?: string }) {
  const t = useTranslations("Nav");

  return (
      <header className={cx("border-t-2 border-b border-t-rule border-b-line bg-bg text-ink", className)}>
        <div className={cx(CONTAINER, "flex min-h-14 items-stretch justify-between gap-6")}>
          <SiteLogo fields />
          <nav aria-label={t("mainLabel")} className="hidden xl:flex">
            <ul className="flex">
              {MAIN_NAV.map((item) => (
                <li key={item.href} className="flex">
                  <NavLink
                    href={item.href}
                    className={cx(
                      "flex items-center px-3.5 text-[15px] whitespace-nowrap text-ink-2 no-underline transition-state hover:text-ink",
                      "aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--accent)]",
                      FOCUS_RING,
                      "focus-visible:-outline-offset-2",
                    )}
                  >
                    {t(item.label)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <div className="hidden items-center gap-1 md:flex">
              <LanguageSwitch />
              <ThemeSwitch />
              <AuthLink />
            </div>
            <ConsultationButton className="max-sm:px-3" />
            <MobileMenu
              extra={
                <div className="md:hidden">
                  <AuthLink className="w-full" />
                </div>
              }
            />
          </div>
        </div>
      </header>
  );
}
