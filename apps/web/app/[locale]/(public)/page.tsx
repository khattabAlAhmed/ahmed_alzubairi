import { SITE_NAME, type Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { composeHome, HeroSection, HomeBlockView, LetterSection } from "@/components/public/home";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { defaultOgImage, pageMetadata } from "@/lib/seo";
import { getHomeSections, getHomeStats, type HomeStat } from "@/lib/content";
import { getLetterWrittenAt } from "@/lib/content/home";

/**
 * Reads that the hero and the letter need before the first paint. They are
 * small and cached; a failure leaves out the ledger or the date, never the
 * section.
 */
async function loadOpening(locale: Locale, withStats: boolean, withLetter: boolean) {
  const [stats, writtenAt] = await Promise.all([
    withStats ? getHomeStats(locale).catch((): HomeStat[] => []) : Promise.resolve([]),
    withLetter ? getLetterWrittenAt().catch(() => null) : Promise.resolve(null),
  ]);
  return { stats, writtenAt };
}

/**
 * Renders on request, never at build: Vercel doesn't give Sensitive variables
 * to an outside build, so the build can't read Supabase. The lib/content reads
 * stay cached and are revalidated by tag (§9). Nothing here reads the session.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Seo" });
  return pageMetadata({
    locale,
    path: "/",
    description: t("description"),
    languages: routing.locales,
    image: defaultOgImage(locale, t("ogAlt", { siteName: SITE_NAME })),
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();

  // The dashboard's visible, published sections in its order. Each block
  // reads its own rows (components/public/home/blocks.tsx), so one failed
  // read shows that section's error and the rest of the page still renders.
  const blocks = composeHome(await getHomeSections(locale));
  const hero = blocks.find((block) => block.key === "hero");
  const opening = await loadOpening(
    locale,
    hero?.key === "hero" && hero.withStats,
    blocks.some((block) => block.key === "letter"),
  );

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      {!hero && <h1 className="sr-only">{SITE_NAME}</h1>}
      {blocks.map((block) => {
        switch (block.key) {
          case "hero":
            return <HeroSection key="hero" content={block.section.content} stats={opening.stats} />;
          case "letter":
            return (
              <LetterSection key="letter" content={block.section.content} writtenAt={opening.writtenAt} locale={locale} />
            );
          default:
            return <HomeBlockView key={block.key} block={block} locale={locale} />;
        }
      })}
    </main>
  );
}
