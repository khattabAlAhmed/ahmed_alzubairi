import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ServiceDetailPage } from "@/components/public/pages";
import { getServiceProjects } from "@/components/public/pages/related";
import { routeSlug, staticSlugs } from "@/components/public/pages/static-slugs";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas, getFaqs, getService, getServices } from "@/lib/content";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** The services published in this language; any other slug renders the not-found page. */
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!hasLocale(routing.locales, params.locale)) return staticSlugs([]);
  return staticSlugs((await getServices(params.locale)).map((service) => service.slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const service = await getService(routeSlug(slug), locale);
  return service ? { title: service.title } : {};
}

export default async function ServicePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

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
