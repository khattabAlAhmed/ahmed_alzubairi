import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHero } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getFaqs } from "@/lib/content";
import { FaqList } from "./faq-list";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("faq") };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();
  const [t, faqs] = await Promise.all([getTranslations({ locale, namespace: "Nav" }), getFaqs(locale)]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("faq")} />
      <FaqList faqs={faqs} />
    </main>
  );
}
