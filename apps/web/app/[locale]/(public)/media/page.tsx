import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MediaList, parseMediaQuery } from "@/components/public/media";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { CONTAINER, PageHero } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getMediaItems } from "@/lib/content/media";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "media");
}

/**
 * The category lives in the query, which only exists at request time. The
 * items behind it are cached by tag in `lib/content`.
 */
async function MediaFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const query = parseMediaQuery(await searchParams);
  // Every item: the chips count each category, and the list filters here.
  const items = await getMediaItems(locale);
  return <MediaList items={items} query={query} />;
}

export default async function Media({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Media" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <PageHero eyebrow={t("eyebrow")} title={t("heading")} intro={<p>{t("lead")}</p>} />
      <div className={CONTAINER}>
        <Suspense fallback={<ListSkeleton kind="articles" label={t("loading")} rows={4} />}>
          <MediaFromQuery locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
