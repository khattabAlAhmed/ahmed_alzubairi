import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ServicesListPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getService, getServices } from "@/lib/content";
import { splitStages } from "@/components/public/pages";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "services");
}

export default async function Services({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const services = await getServices(locale);
  // Each row's number of stages: the list read doesn't carry them, so each
  // service's detail read (cached by tag) does.
  const details = await Promise.all(services.map((service) => getService(service.slug, locale)));
  const stageCounts: Record<string, number> = {};
  details.forEach((detail) => {
    const count = detail?.stages ? splitStages(detail.stages).length : 0;
    if (detail && count > 1) stageCounts[detail.id] = count;
  });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ServicesListPage services={services} stageCounts={stageCounts} />
    </main>
  );
}
