import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { contactChannels } from "@/components/public/contact";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { getSiteSettings } from "@/lib/content";
import { FOOTER_NAV } from "./nav-items";
import { SiteLogo } from "./site-logo";

const LINK = cx("rounded-sm text-sm text-text-secondary underline-offset-4 hover:text-text hover:underline", FOCUS_RING);

/**
 * Every contact channel set in site settings (§6.1). Renders on request inside
 * Suspense, so the footer's shell stays static and the build never reads
 * Supabase. It reads no session.
 */
export async function FooterChannels() {
  await connection();
  const t = await getTranslations("Contact");
  const tFooter = await getTranslations("Footer");

  let settings;
  try {
    settings = await getSiteSettings();
  } catch (error) {
    // The channels are extra: a failed read must not take the page down.
    console.error("footer: site settings failed", error);
    return null;
  }

  const channels = contactChannels(settings, (key) => t(key));
  if (channels.length === 0) return null;

  return (
    <ul aria-label={tFooter("contactLabel")} className="flex flex-col gap-2">
      {channels.map((channel) => (
        <li key={channel.key} className="min-w-0">
          <a
            href={channel.href}
            className={`${LINK} break-all`}
            {...(channel.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {channel.label}
            {": "}
            {/* Numbers, addresses and links read left to right in both languages. */}
            <bdi dir="ltr">{channel.value}</bdi>
            {channel.newTab && <span className="sr-only"> {t("opensInNewTab")}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The public footer: brand and channels, section links, then the legal links (§6.1). */
export function SiteFooter() {
  const t = useTranslations("Footer");
  const tNav = useTranslations("Nav");

  return (
    <footer className="mt-auto border-t border-text/10 bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        {/* Brand and contact channels, then the section links. */}
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <SiteLogo />
            {/* Gold as a divider, never as text (§13). */}
            <span aria-hidden="true" className="mt-3 block h-0.5 w-10 rounded-full bg-accent" />
          </div>
          <Suspense>
            <FooterChannels />
          </Suspense>
        </div>
        <nav aria-label={t("sectionsLabel")}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
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
          className="border-t border-text/10 pt-6 lg:col-span-2"
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
