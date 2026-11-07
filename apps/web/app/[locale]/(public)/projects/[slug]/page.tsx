import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ProjectDetailPage, routeSlug, staticSlugs } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas, getProject, getProjects } from "@/lib/content";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** The projects published in this language; any other slug renders the not-found page. */
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!hasLocale(routing.locales, params.locale)) return staticSlugs([]);
  return staticSlugs((await getProjects(params.locale)).map((project) => project.slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const project = await getProject(routeSlug(slug), locale);
  return project ? { title: project.title } : {};
}

export default async function ProjectPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const project = await getProject(routeSlug(slug), locale);
  if (!project) notFound();
  const areas = await getExpertiseAreas(locale);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ProjectDetailPage project={project} area={areas.find((area) => area.id === project.expertiseId) ?? null} />
    </main>
  );
}
