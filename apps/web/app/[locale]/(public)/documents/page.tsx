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
import { splitLines } from "@/components/public/pages/identity";
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

/**
 * The header, with the count in the eyebrow once the list is known, and the
 * three steps (request, decision, opening) in its end column, as the
 * Documents mockup sets them.
 */
async function DocumentsHero({ locale, count }: { locale: Locale; count?: number }) {
  const [t, tNav] = await Promise.all([
    getTranslations({ locale, namespace: "Catalog" }),
    getTranslations({ locale, namespace: "Nav" }),
  ]);
  return (
    <PageHero
      eyebrow={count ? t("documentsPage.eyebrow", { count }) : tNav("documents")}
      title={t("documentsPage.title")}
      intro={<p>{t("documentsPage.intro")}</p>}
      aside={<HowItWorks label={t("documentsPage.stepsLabel")} steps={splitLines(t("documentsPage.steps"))} locale={locale} />}
    />
  );
}

/** Request, decision, opening: numbered lines between hairlines, the number in `ink-2`. */
function HowItWorks({ label, steps, locale }: { label: string; steps: string[]; locale: Locale }) {
  return (
    <ol aria-label={label} className="border-t border-line">
      {steps.map((step, index) => (
        <li key={index} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 border-b border-line py-2.5 type-small">
          <span aria-hidden="true" className="font-medium text-ink-2 tabular-nums">
            {formatNumber(index + 1, locale)}
          </span>
          <span className="text-pretty">{step}</span>
        </li>
      ))}
    </ol>
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
      <div className={`${CONTAINER} mt-2`}>
        {/* Only the request flow's strings go to the browser. */}
        <NextIntlClientProvider locale={locale} messages={{ DocumentRequestDialog }}>
          <DocumentsList documents={documents} />
        </NextIntlClientProvider>
      </div>
    </>
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
            <div className={`${CONTAINER} mt-2`}>
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
