import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ExpertiseListPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas } from "@/lib/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("expertise") };
}

export default async function Expertise({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ExpertiseListPage areas={await getExpertiseAreas(locale)} />
    </main>
  );
}
