import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { CONTAINER, PageHero } from "@/components/public/parts";
import { parseResourcesQuery, ResourcesList } from "@/components/public/resources";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas } from "@/lib/content";
import { getResources } from "@/lib/content/resources";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "resources");
}

/**
 * The filters live in the query, which only exists at request time. The
 * resources and areas behind them are cached by tag in `lib/content`.
 */
async function ResourcesFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const query = parseResourcesQuery(await searchParams);
  const [resources, areas, messages] = await Promise.all([
    getResources(locale, { expertise: query.area ?? undefined, kind: query.kind ?? undefined }),
    getExpertiseAreas(locale),
    getMessages({ locale }),
  ]);
  // The download buttons and the email gate are client components that read
  // `Resources`; the root layout gives the browser only Header, Nav and Error.
  // The browser gets only this namespace.
  return (
    <NextIntlClientProvider locale={locale} messages={{ Resources: messages.Resources }}>
      <ResourcesList resources={resources} areas={areas} query={query} />
    </NextIntlClientProvider>
  );
}

export default async function Resources({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Resources" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <PageHero eyebrow={t("eyebrow")} title={t("heading")} intro={<p>{t("lead")}</p>} />
      <div className={CONTAINER}>
        <Suspense fallback={<ListSkeleton kind="resources" label={t("loading")} rows={4} />}>
          <ResourcesFromQuery locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
