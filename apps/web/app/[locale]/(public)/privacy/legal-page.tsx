import type { PageKey } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LanguageFallback } from "@/components/language-switch";
import { CONTAINER, PageHero } from "@/components/public/parts";
import { RichText } from "@/components/public/rich-text";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { otherLocale, routing } from "@/i18n/routing";
import { getPage } from "@/lib/content";

export type LegalKey = Extract<PageKey, "privacy" | "terms">;
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
    return page ? { title: page.title } : {};
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

    return (
      <main id={MAIN_CONTENT_ID} className="flex-1">
        {/* A page with no translation sends the switch home instead (§6.1). */}
        {!page.availableIn.includes(otherLocale(locale)) && <LanguageFallback href="/" />}
        <PageHero title={page.title} />
        <div className={`${CONTAINER} py-12 md:py-16`}>
          <RichText doc={page.body} className="max-w-prose text-lg" />
        </div>
      </main>
    );
  };
}
