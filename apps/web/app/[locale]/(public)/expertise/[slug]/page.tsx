import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ExpertiseDetailPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseArea, getExpertiseAreas, getProjects, getServices } from "@/lib/content";
import { routeSlug, staticSlugs } from "@/components/public/pages/static-slugs";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** The areas published in this language; any other slug renders the not-found page. */
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!hasLocale(routing.locales, params.locale)) return staticSlugs([]);
  return staticSlugs((await getExpertiseAreas(params.locale)).map((area) => area.slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const area = await getExpertiseArea(routeSlug(slug), locale);
  return area ? { title: area.title } : {};
}

export default async function ExpertiseArea({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const area = await getExpertiseArea(routeSlug(slug), locale);
  if (!area) notFound();
  const [services, projects] = await Promise.all([getServices(locale), getProjects(locale)]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ExpertiseDetailPage
        area={area}
        services={services.filter((service) => service.expertiseId === area.id)}
        projects={projects.filter((project) => project.expertiseId === area.id)}
      />
    </main>
  );
}
