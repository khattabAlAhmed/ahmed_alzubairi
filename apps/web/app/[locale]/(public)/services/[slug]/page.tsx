import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ServiceDetailPage } from "@/components/public/pages";
import { getServiceProjects } from "@/components/public/pages/service-projects";
import { routeSlug, staticSlugs } from "@/components/public/static-slugs";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas, getFaqs, getService } from "@/lib/content";

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
  const service = await getService(routeSlug(slug), locale);
  return service ? { title: service.title } : {};
}

export default async function ServicePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const service = await getService(routeSlug(slug), locale);
  if (!service) notFound();
  const [areas, projects, faqs] = await Promise.all([
    getExpertiseAreas(locale),
    getServiceProjects(service.id, locale),
    getFaqs(locale),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ServiceDetailPage
        service={service}
        area={areas.find((area) => area.id === service.expertiseId) ?? null}
        projects={projects}
        faqs={faqs.filter((faq) => faq.serviceId === service.id)}
      />
    </main>
  );
}
