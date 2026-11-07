import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ExpertiseDetailPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseArea, getProjects, getServices } from "@/lib/content";
import { routeSlug, staticSlugs } from "@/components/public/pages/static-slugs";

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
  const area = await getExpertiseArea(routeSlug(slug), locale);
  return area ? { title: area.title } : {};
}

export default async function ExpertiseArea({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

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
