import type { PageKey } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { LanguageFallback } from "@/components/language-switch";
import { formatMonth } from "@/components/public/home/format";
import { CONTAINER, Ledger } from "@/components/public/parts";
import { ARTICLE_PROSE, contentHeadings, RichText } from "@/components/public/rich-text/rich-text";
import { SectionIndex } from "@/components/public/section-index";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { cx, INLINE_LINK } from "@/components/ui/cx";
import { otherLocale, routing } from "@/i18n/routing";
import { getPage } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";

export type LegalKey = Extract<PageKey, "privacy" | "terms">;

/** Both legal pages, in the order the side index lists them. */
const LEGAL_PAGES = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
] as const satisfies readonly { key: LegalKey; href: string }[];

/** The ids of the text's parts, for the contents list ("part-1", "part-2"…). */
const PART_PREFIX = "part";
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
    const parts = contentHeadings(page.body, PART_PREFIX);
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
        <article className={cx(CONTAINER, "pt-8 pb-section md:pt-12")}>
          <div className="grid gap-8 border-t-2 border-rule pt-6 lg:grid-cols-12 lg:gap-gutter">
            <aside className="flex flex-col gap-4 self-start lg:col-span-3">
              <SectionIndex
                label={t("indexLabel")}
                items={LEGAL_PAGES.map((item) => ({ label: footer(item.key), href: item.href, current: item.key === key }))}
              />
              <Ledger
                facts={[
                  {
                    label: t("lastUpdated"),
                    value: <time dateTime={page.updatedAt}>{formatMonth(page.updatedAt, locale)}</time>,
                  },
                ]}
              />
              {parts.length > 1 && (
                <nav aria-label={t("contentsLabel")} className="flex flex-col items-start gap-1.5 border-t border-line pt-3">
                  {parts.map((part) => (
                    <a key={part.id} href={`#${part.id}`} className={cx(INLINE_LINK, "text-[14px]")}>
                      {part.label}
                    </a>
                  ))}
                </nav>
              )}
            </aside>
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-6">
              <h1 className="type-h1 text-balance settle">{page.title}</h1>
              {/* The contents links land each part below the sticky header. */}
              <RichText doc={page.body} className={cx(ARTICLE_PROSE, "[&_[id]]:scroll-mt-24")} headingIds={PART_PREFIX} />
            </div>
          </div>
        </article>
      </main>
    );
  };
}
