import type { Locale, OrgType } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { formatNumber } from "@/components/public/home/format";
import { CONTAINER, PageHero, parsePage, parseProjectFilters, ProjectsList } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas, getProjects, type Project } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";
import { lastUpdated } from "./last-updated";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "projects");
}

/** The ledger: how many projects, and when one was last edited. */
function facts(projects: Project[], locale: Locale, t: (key: "count" | "updated") => string) {
  const updated = lastUpdated(projects, locale);
  return [
    { label: t("count"), value: formatNumber(projects.length, locale) },
    ...(updated ? [{ label: t("updated"), value: updated }] : []),
  ];
}

/** The page header with its ledger, cached per language. */
async function ProjectsHeader({ locale }: { locale: Locale }) {
  "use cache";
  const [projects, t] = await Promise.all([
    getProjects(locale),
    getTranslations({ locale, namespace: "Catalog.projectsPage" }),
  ]);
  return <PageHero eyebrow={t("eyebrow")} title={t("title")} intro={<p>{t("intro")}</p>} facts={facts(projects, locale, t)} />;
}

/** The ledger needs the projects, and the build never reads Supabase: this waits for a request. */
async function HeaderOnRequest({ locale }: { locale: Locale }) {
  await connection();
  return <ProjectsHeader locale={locale} />;
}

/** The header while the ledger loads: the same words, no facts yet. */
async function HeaderWithoutFacts({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Catalog.projectsPage" });
  return <PageHero eyebrow={t("eyebrow")} title={t("title")} intro={<p>{t("intro")}</p>} />;
}

/** Cached per language, filter and page, so each list is built once. */
async function FilteredProjects({
  locale,
  area,
  orgType,
  page,
}: {
  locale: Locale;
  area: string | null;
  orgType: OrgType | null;
  page: number;
}) {
  "use cache";
  const [projects, areas] = await Promise.all([getProjects(locale), getExpertiseAreas(locale)]);
  return <ProjectsList projects={projects} areas={areas} filters={{ area, orgType }} page={page} />;
}

/** The filters and the page live in the query, which only exists at request time. */
async function ProjectsFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const filters = parseProjectFilters(query);
  return <FilteredProjects locale={locale} area={filters.area} orgType={filters.orgType} page={parsePage(query)} />;
}

export default async function Projects({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Catalog.projectsPage" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Suspense fallback={<HeaderWithoutFacts locale={locale} />}>
        <HeaderOnRequest locale={locale} />
      </Suspense>
      <div className={`${CONTAINER} pb-section`}>
        <Suspense fallback={<ListSkeleton kind="projects" label={t("loading")} className="mt-2" />}>
          <ProjectsFromQuery locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
