import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ServicesListPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getServices } from "@/lib/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("services") };
}

export default async function Services({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ServicesListPage services={await getServices(locale)} />
    </main>
  );
}
