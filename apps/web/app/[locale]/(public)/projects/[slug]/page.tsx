import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProjectDetailPage, routeSlug, staticSlugs } from "@/components/public/projects";
import { LanguageFallback } from "@/components/language-switch";
import { ConsultationCta } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { otherLocale, routing } from "@/i18n/routing";
import { getExpertiseAreas, getProject } from "@/lib/content";

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * A placeholder only: Cache Components needs one static param, and the build
 * must never read Supabase. Real slugs render on their first request.
 */
export function generateStaticParams() {
  return staticSlugs([]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  await connection();
  const project = await getProject(routeSlug(slug), locale);
  return project ? { title: project.title } : {};
}

export default async function ProjectPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const project = await getProject(routeSlug(slug), locale);
  if (!project) notFound();
  const areas = await getExpertiseAreas(locale);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      {/* No translation: the switch goes to the projects list instead (§6.1). */}
      {!project.availableIn.includes(otherLocale(locale)) && <LanguageFallback href="/projects" />}
      <ProjectDetailPage project={project} area={areas.find((area) => area.id === project.expertiseId) ?? null} />
      {/* Every section page ends with the way to a consultation, like expertise and services. */}
      <ConsultationCta />
    </main>
  );
}
