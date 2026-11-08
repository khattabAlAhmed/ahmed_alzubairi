import type { Locale, OrgType } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHero, parseProjectFilters, ProjectsList } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Skeleton } from "@/components/ui";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas, getProjects } from "@/lib/content";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("projects") };
}

/** Cached per language and filter, so each filtered list is built once. */
async function FilteredProjects({ locale, area, orgType }: { locale: Locale; area: string | null; orgType: OrgType | null }) {
  "use cache";
  const [projects, areas] = await Promise.all([getProjects(locale), getExpertiseAreas(locale)]);
  return <ProjectsList projects={projects} areas={areas} filters={{ area, orgType }} />;
}

/** The filters live in the query, which only exists at request time. */
async function ProjectsFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const filters = parseProjectFilters(await searchParams);
  return <FilteredProjects locale={locale} area={filters.area} orgType={filters.orgType} />;
}

function ProjectsLoading() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default async function Projects({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Nav" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("projects")} />
      <Suspense fallback={<ProjectsLoading />}>
        <ProjectsFromQuery locale={locale} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
