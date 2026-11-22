import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { formatNumber } from "@/components/public/home/format";
import { CONTAINER, PageHero } from "@/components/public/parts";
import { StageStrip } from "@/components/public/pages/identity";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getPublicDocuments } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";
import { DocumentsList } from "./documents-list";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "documents");
}

/** The header, with the count in the eyebrow once the list is known. */
async function DocumentsHero({ locale, count }: { locale: Locale; count?: number }) {
  const t = await getTranslations({ locale, namespace: "Catalog" });
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  return (
    <PageHero
      eyebrow={count ? t("documentsPage.eyebrow", { count }) : tNav("documents")}
      title={t("documentsPage.title")}
      intro={<p>{t("documentsPage.intro")}</p>}
    />
  );
}

/** Titles and categories only (§6.12, §9): no file, no storage key reaches this page. */
async function DocumentsFromDb({ locale }: { locale: Locale }) {
  await connection();
  const [documents, { DocumentRequestDialog }] = await Promise.all([
    getPublicDocuments(locale),
    getMessages({ locale }),
  ]);
  return (
    <>
      <DocumentsHero locale={locale} count={documents.length} />
      <HowItWorks locale={locale} />
      <div className={`${CONTAINER} mt-10`}>
        {/* Only the request flow's strings go to the browser. */}
        <NextIntlClientProvider locale={locale} messages={{ DocumentRequestDialog }}>
          <DocumentsList documents={documents} />
        </NextIntlClientProvider>
      </div>
    </>
  );
}

/** Request, decision, opening: three numbered steps right under the header. */
async function HowItWorks({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Catalog" });
  return (
    <section aria-labelledby="documents-steps" className={CONTAINER}>
      <h2 id="documents-steps" className="sr-only">
        {t("documentsPage.stepsLabel")}
      </h2>
      <StageStrip text={t("documentsPage.steps")} formatIndex={(n) => formatNumber(n, locale)} />
    </section>
  );
}

export default async function Documents({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Catalog" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <Suspense
        fallback={
          <>
            <DocumentsHero locale={locale} />
            <HowItWorks locale={locale} />
            <div className={`${CONTAINER} mt-10`}>
              <ListSkeleton kind="documents" label={t("documentsPage.loading")} rows={4} />
            </div>
          </>
        }
      >
        <DocumentsFromDb locale={locale} />
      </Suspense>
    </main>
  );
}
