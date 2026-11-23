import type { PageKey } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { LanguageFallback } from "@/components/language-switch";
import { CONTAINER } from "@/components/public/parts";
import { RichText } from "@/components/public/rich-text";
import { ARTICLE_PROSE } from "@/components/public/rich-text/rich-text";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { otherLocale, routing } from "@/i18n/routing";
import { getPage } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";

export type LegalKey = Extract<PageKey, "privacy" | "terms">;

/** Both legal pages, in the order the side index lists them. */
const LEGAL_PAGES = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
] as const satisfies readonly { key: LegalKey; href: string }[];
type Props = { params: Promise<{ locale: string }> };

/**
 * Privacy and terms (§6.25). The text comes only from `pages`: none of it lives
 * in code, and until Ahmed reviews it, it is the dev seed's draft (§14 #8).
 */
export function legalMetadata(key: LegalKey) {
  return async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) return {};
    await connection();
    const page = await getPage(key, locale);
    // hreflang only for the languages the page's content is published in.
    return page ? staticPageMetadata(locale, key, page.availableIn) : {};
  };
}

export function legalPage(key: LegalKey) {
  return async function LegalPage({ params }: Props) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    // Renders on request: the build never reads Supabase. Reads stay cached by tag.
    await connection();

    const page = await getPage(key, locale);
    if (!page) notFound();
    const [t, footer] = await Promise.all([
      getTranslations({ locale, namespace: "Pages.legal" }),
      getTranslations({ locale, namespace: "Footer" }),
    ]);

    // The Legal board: one record under the heavy rule. The start column
    // names both legal pages; the text reads at the article measure.
    return (
      <main id={MAIN_CONTENT_ID} className="flex-1">
        {/* A page with no translation sends the switch home instead (§6.1). */}
        {!page.availableIn.includes(otherLocale(locale)) && <LanguageFallback href="/" />}
        <article className={cx(CONTAINER, "pt-8 pb-16 md:pt-12")}>
          <div className="grid gap-8 border-t-2 border-rule pt-6 lg:grid-cols-12 lg:gap-gutter">
            <aside className="flex flex-col gap-4 self-start lg:col-span-3">
              <nav aria-label={t("indexLabel")}>
                <ul>
                  {LEGAL_PAGES.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={item.key === key ? "page" : undefined}
                        className="flex border-b border-line py-2.5 text-[15px] text-ink-2 no-underline transition-state hover:text-ink focus-ring focus-visible:-outline-offset-2 aria-[current=page]:font-medium aria-[current=page]:text-ink"
                      >
                        {footer(item.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-6">
              <h1 className="type-h1 text-balance settle">{page.title}</h1>
              <RichText doc={page.body} className={ARTICLE_PROSE} />
            </div>
          </div>
        </article>
      </main>
    );
  };
}
