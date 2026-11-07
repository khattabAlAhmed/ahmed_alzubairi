import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ClientsContent } from "@/components/public/clients";
import { PageHero } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getPartners, getTestimonials } from "@/lib/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("clients") };
}

export default async function Clients({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();
  const [t, partners, testimonials] = await Promise.all([
    getTranslations({ locale, namespace: "Nav" }),
    getPartners(locale),
    getTestimonials(locale),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("clients")} />
      <ClientsContent partners={partners} testimonials={testimonials} />
    </main>
  );
}
