import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense, type SVGProps } from "react";
import { contactChannels } from "@/components/public/contact";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { getSiteSettings } from "@/lib/content";
import { AuthLink } from "./auth-link";
import { ConsultationButton } from "./consultation-button";
import { LanguageSwitch } from "./language-switch";
import { MobileMenu } from "./mobile-menu";
import { MAIN_NAV } from "./nav-items";
import { NavLink } from "./nav-link";
import { SiteLogo } from "./site-logo";
import { ThemeSwitch } from "./theme-switch";

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5" {...props}>
      <path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3z" />
    </svg>
  );
}

type Variant = "bar" | "menu";

/**
 * WhatsApp and email from site settings, always present (§6.1). It renders on
 * request inside a Suspense boundary, so the header's shell stays static and
 * the build never reads Supabase. It reads no session.
 */
export async function QuickContact({ variant }: { variant: Variant }) {
  await connection();
  const t = await getTranslations("Contact");
  const tHeader = await getTranslations("Header");

  let settings;
  try {
    settings = await getSiteSettings();
  } catch (error) {
    // Quick contact is extra: a failed read must not take the page down.
    console.error("quick contact: site settings failed", error);
    return null;
  }

  const channels = contactChannels(
    { ...settings, linkedinUrl: null, socialLinks: [] },
    (key) => t(key),
  );
  if (channels.length === 0) return null;

  return (
    <ul
      aria-label={tHeader("quickContact")}
      className={variant === "bar" ? "flex items-center gap-1" : "grid gap-1"}
    >
      {channels.map((channel) => {
        const Icon = channel.key === "email" ? MailIcon : ChatIcon;
        const newTab = channel.newTab
          ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
          : {};
        return (
          <li key={channel.key}>
            {variant === "bar" ? (
              <a
                href={channel.href}
                {...newTab}
                className={cx("inline-flex size-9 items-center justify-center rounded-md hover:bg-text/10", FOCUS_RING)}
              >
                <Icon />
                <span className="sr-only">
                  {channel.label}
                  {channel.newTab && ` ${t("opensInNewTab")}`}
                </span>
              </a>
            ) : (
              <a
                href={channel.href}
                {...newTab}
                className={cx("flex items-center gap-3 rounded-md px-3 py-3 hover:bg-text/10", FOCUS_RING, "focus-visible:-outline-offset-2")}
              >
                <Icon />
                <span>{channel.label}</span>
                {/* Numbers and addresses read left to right in both languages. */}
                <bdi dir="ltr" className="ms-auto truncate text-sm text-text-secondary">
                  {channel.value}
                </bdi>
                {channel.newTab && <span className="sr-only">{t("opensInNewTab")}</span>}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SiteHeader() {
  const t = useTranslations("Nav");

  return (
    <header className="relative z-40 border-b border-text/10 bg-surface">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-2 gap-y-3 px-4 py-3">
        <SiteLogo />
        <nav aria-label={t("mainLabel")} className="ms-6 hidden xl:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className={cx(
                    "relative block rounded-md px-2.5 py-2 text-sm whitespace-nowrap hover:bg-text/10 aria-[current=page]:font-semibold",
                    // A gold bar under the current page: gold as an accent, never as text (§13).
                    "after:absolute after:inset-x-2.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent after:opacity-0 aria-[current=page]:after:opacity-100",
                    FOCUS_RING,
                  )}
                >
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {/*
          Phones get two rows: logo and controls, then the full-width button.
          Sign-in and quick contact move into the menu there, so the first row
          always fits at 375 px.
        */}
        <ConsultationButton className="order-last w-full justify-center sm:order-none sm:ms-auto sm:w-auto" />
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:ms-0">
          <div className="hidden md:block">
            <Suspense>
              <QuickContact variant="bar" />
            </Suspense>
          </div>
          <div className="hidden sm:contents">
            <AuthLink />
          </div>
          <LanguageSwitch />
          <ThemeSwitch />
          <MobileMenu
            extra={
              <>
                <div className="border-t border-text/10 px-1 py-2 sm:hidden">
                  <AuthLink />
                </div>
                <div className="border-t border-text/10 py-2 md:hidden">
                  <Suspense>
                    <QuickContact variant="menu" />
                  </Suspense>
                </div>
              </>
            }
          />
        </div>
      </div>
    </header>
  );
}
