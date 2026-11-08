import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { contactChannels } from "@/components/public/contact";
import { Link } from "@/i18n/navigation";
import { getSiteSettings } from "@/lib/content";
import { FOOTER_NAV } from "./nav-items";
import { SiteLogo } from "./site-logo";

const LINK = "text-sm text-text-secondary hover:text-text";

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
    <ul aria-label={tFooter("contactLabel")} className="flex flex-wrap gap-x-6 gap-y-2">
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
        <Suspense>
          <FooterChannels />
        </Suspense>
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
