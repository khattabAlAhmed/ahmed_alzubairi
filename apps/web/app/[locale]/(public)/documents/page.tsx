import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHero } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getPublicDocuments } from "@/lib/content";
import { DocumentsList } from "./documents-list";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("documents") };
}

export default async function Documents({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();
  const [tNav, t, documents, { DocumentRequestDialog }] = await Promise.all([
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Catalog" }),
    getPublicDocuments(locale),
    getMessages({ locale }),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={tNav("documents")} intro={t("documentsIntro")} />
      {/* Only the request flow's strings go to the browser. */}
      <NextIntlClientProvider locale={locale} messages={{ DocumentRequestDialog }}>
        <DocumentsList documents={documents} />
      </NextIntlClientProvider>
    </main>
  );
}
