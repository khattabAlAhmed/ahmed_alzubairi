import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ExpertiseListPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas, getProjects, getServices } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "expertise");
}

export default async function Expertise({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const [areas, services, projects] = await Promise.all([
    getExpertiseAreas(locale),
    getServices(locale),
    getProjects(locale),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ExpertiseListPage areas={areas} services={services} projects={projects} />
    </main>
  );
}
