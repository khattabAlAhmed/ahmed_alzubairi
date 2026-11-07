import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { AboutPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getPage, getSiteSettings, getTimeline } from "@/lib/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const page = await getPage("about", locale);
  return page ? { title: page.title } : {};
}

// Static: lib/content reads are cached by tag, and nothing here reads the session.
export default async function About({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [page, timeline, settings] = await Promise.all([
    getPage("about", locale),
    getTimeline(locale),
    getSiteSettings(),
  ]);
  if (!page) notFound();

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <AboutPage page={page} timeline={timeline} cvUrl={settings.cvUrl} />
    </main>
  );
}
