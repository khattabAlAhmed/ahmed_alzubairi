import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { CONTAINER, PageHero } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { INLINE_LINK } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getFaqs } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";
import { FaqList } from "./faq-list";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "faq");
}

async function FaqsFromDb({ locale }: { locale: Locale }) {
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();
  return <FaqList faqs={await getFaqs(locale)} />;
}

/** §6.13: questions grouped by category, one open at a time. */
export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Catalog" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <PageHero
        eyebrow={t("faqPage.eyebrow")}
        title={t("faqPage.title")}
        intro={
          <p>
            {t.rich("faqPage.intro", {
              link: (chunks) => (
                <Link href="/contact" className={INLINE_LINK}>
                  {chunks}
                </Link>
              ),
            })}
          </p>
        }
      />
      <div className={`${CONTAINER} mt-6 md:mt-10`}>
        <Suspense fallback={<ListSkeleton kind="articles" label={t("faqPage.loading")} rows={5} />}>
          <FaqsFromDb locale={locale} />
        </Suspense>
      </div>
    </main>
  );
}
