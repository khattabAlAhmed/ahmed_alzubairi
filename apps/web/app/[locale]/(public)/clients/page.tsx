import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Locale } from "@repo/shared";
import { ClientsContent, ClientsSkeleton } from "@/components/public/clients";
import { formatNumber } from "@/components/public/home/format";
import { PageHero } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getPartners, getTestimonials } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "clients");
}

/** The header and the list: both need the partners, so both wait for a request. */
async function ClientsOnRequest({ locale }: { locale: Locale }) {
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();
  const [t, partners, testimonials] = await Promise.all([
    getTranslations({ locale, namespace: "Catalog.clientsPage" }),
    getPartners(locale),
    getTestimonials(locale),
  ]);
  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={<p>{t("intro")}</p>}
        facts={partners.length > 0 ? [{ label: t("organizations"), value: formatNumber(partners.length, locale) }] : undefined}
      />
      <ClientsContent partners={partners} testimonials={testimonials} />
    </>
  );
}

export default async function Clients({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Catalog.clientsPage" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      {/* While the list loads: the same header without its count, then the board's skeleton. */}
      <Suspense
        fallback={
          <>
            <PageHero eyebrow={t("eyebrow")} title={t("title")} intro={<p>{t("intro")}</p>} />
            <ClientsSkeleton label={t("loading")} />
          </>
        }
      >
        <ClientsOnRequest locale={locale} />
      </Suspense>
    </main>
  );
}
