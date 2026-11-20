import { SITE_NAME } from "@repo/shared";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Fragment, Suspense } from "react";
import { NewsletterSignup } from "@/components/newsletter";
import { contactChannels } from "@/components/public/contact";
import { CONTAINER } from "@/components/public/parts";
import { cx, FOCUS_RING, INLINE_LINK } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { getSiteSettings } from "@/lib/content";
import { FOOTER_GROUPS } from "./nav-items";

const INDEX_LINK = cx(
  "block py-1 text-[15px] text-ink no-underline underline-offset-5 transition-state hover:underline",
  FOCUS_RING,
);

/** A column's small heading: ink-2, never all caps. */
const COLUMN_HEADING = "mb-2.5 text-[13px] font-medium text-ink-2";

/**
 * Every contact channel set in site settings (§6.1), as one line: the number
 * and the address are data, left to right with Western digits; links say
 * where they go. Renders on request inside Suspense, so the footer's shell
 * stays static and the build never reads Supabase. It reads no session.
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
    <ul aria-label={tFooter("contactLabel")} className="type-caption flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ink-2">
      {channels.map((channel, index) => (
        <Fragment key={channel.key}>
          {index > 0 && (
            <li aria-hidden="true" className="list-none">
              ·
            </li>
          )}
          <li className="min-w-0">
            <a
              href={channel.href}
              className={cx(INLINE_LINK, "break-all text-ink-2")}
              {...(channel.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {channel.key === "email" || channel.key === "whatsapp" ? (
                <>
                  <span className="sr-only">{channel.label}: </span>
                  {/* Numbers and addresses read left to right in both languages. */}
                  <bdi dir="ltr" className="font-mono text-xs">
                    {channel.value}
                  </bdi>
                </>
              ) : (
                channel.label
              )}
              {channel.newTab && <span className="sr-only"> {t("opensInNewTab")}</span>}
            </a>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

/**
 * The public footer (the Footer board): his short line, the two indexes of the
 * site, the newsletter and the contact channels, then the legal links.
 */
export function SiteFooter() {
  const t = useTranslations("Footer");
  const tNav = useTranslations("Nav");

  return (
    <footer className="mt-auto pt-section text-ink">
      <div className={CONTAINER}>
        <div className="grid gap-8 border-t-2 border-rule pt-7 pb-5 md:grid-cols-12 md:gap-gutter">
          <div className="flex flex-col gap-2 md:col-span-12 lg:col-span-4">
            <p className="type-h3">{SITE_NAME}</p>
            <p className="type-small max-w-[28em] text-pretty text-ink-2">{t("line")}</p>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.label} aria-label={tNav(group.label)} className="md:col-span-6 lg:col-span-2">
              <h2 className={COLUMN_HEADING}>{tNav(group.label)}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={INDEX_LINK}>
                      {tNav(item.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="flex min-w-0 flex-col gap-4 md:col-span-12 lg:col-span-4">
            <NewsletterSignup source="footer" inFooter />
            <div>
              <h2 className={COLUMN_HEADING}>
                <Link href="/contact" className={cx(INLINE_LINK, "text-ink-2")}>
                  {tNav("contact")}
                </Link>
              </h2>
              <Suspense>
                <FooterChannels />
              </Suspense>
            </div>
          </div>
        </div>
        {/* Room at the end for the quick-contact tab, so it never covers the last line. */}
        <nav
          aria-label={t("legalLabel")}
          className="type-caption flex flex-wrap justify-between gap-4 border-t border-line pt-3.5 pb-20 text-ink-2"
        >
          <p>© {SITE_NAME}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/privacy" className={cx(INLINE_LINK, "text-ink-2")}>
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={cx(INLINE_LINK, "text-ink-2")}>
                {t("terms")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
