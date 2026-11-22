import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AboutPage } from "@/components/public/pages";
import { LanguageFallback } from "@/components/language-switch";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { otherLocale, routing } from "@/i18n/routing";
import { getHomeSections, getHomeStats, getPage, getSiteSettings, getTimeline } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  await connection();
  const page = await getPage("about", locale);
  // hreflang only for the languages the page's content is published in.
  return page ? staticPageMetadata(locale, "about", page.availableIn) : {};
}

export default async function About({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const [page, timeline, stats, sections, settings] = await Promise.all([
    getPage("about", locale),
    getTimeline(locale),
    getHomeStats(locale),
    getHomeSections(locale),
    getSiteSettings(),
  ]);
  if (!page) notFound();
  // The portrait is the home hero's photo (no about photo field in Phase 8).
  const hero = sections.find((section) => section.key === "hero");
  const portrait =
    hero?.key === "hero" && hero.content.photoUrl ? { src: hero.content.photoUrl, name: hero.content.name } : null;

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      {/* No translation: the switch goes to the home page, never to an empty page (§6.1). */}
      {!page.availableIn.includes(otherLocale(locale)) && <LanguageFallback href="/" />}
      <AboutPage page={page} timeline={timeline} stats={stats} cvUrl={settings.cvUrl} portrait={portrait} />
    </main>
  );
}
