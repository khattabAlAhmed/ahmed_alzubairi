import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { formatNumber } from "@/components/public/home/format";
import { CONTAINER, PageHero, type PageFact } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { CourseList } from "@/components/training/course-list";
import { CustomRequestForm } from "@/components/training/custom-request-form";
import { parseTypeFilter } from "@/components/training/data";
import { CUSTOM_TRAINING_ID } from "@/components/training/paths";
import { routing } from "@/i18n/routing";
import { getCourses } from "@/lib/content/courses";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type Translator = Awaited<ReturnType<typeof getTranslations<"Training">>>;
type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "training");
}

/**
 * The type filter lives in the query, which only exists at request time. The
 * courses behind it are cached by tag in `lib/content`. The header's ledger
 * counts the same courses, so it renders here too; the fallback shows the
 * header without it.
 */
async function TrainingFromQuery({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: Promise<SearchParams>;
}) {
  // Request data first: getCourses reads the clock.
  const [{ type: rawType }] = await Promise.all([searchParams, connection()]);
  const [courses, t] = await Promise.all([getCourses(locale), getTranslations({ locale, namespace: "Training" })]);
  const dated = courses.filter((course) => course.startsAt !== null).length;
  return (
    <>
      <TrainingHero
        t={t}
        facts={dated > 0 ? [{ label: t("trainingPage.upcoming"), value: formatNumber(dated, locale) }] : []}
      />
      <div className={`${CONTAINER} mt-6 md:mt-10`}>
        <CourseList courses={courses} type={parseTypeFilter(rawType)} />
      </div>
    </>
  );
}

function TrainingHero({ t, facts = [] }: { t: Translator; facts?: PageFact[] }) {
  return (
    <PageHero
      eyebrow={t("title")}
      title={t("trainingPage.heading")}
      intro={<p>{t("trainingPage.lead")}</p>}
      facts={facts}
    />
  );
}

/** §6.7: the courses as a schedule, then the custom training request. It reads no session. */
export default async function TrainingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, { Training }] = await Promise.all([
    getTranslations({ locale, namespace: "Training" }),
    getMessages({ locale }),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <Suspense
        fallback={
          <>
            <TrainingHero t={t} />
            <div className={`${CONTAINER} mt-6 md:mt-10`}>
              <ListSkeleton kind="courses" label={t("trainingPage.loading")} rows={3} />
            </div>
          </>
        }
      >
        <TrainingFromQuery locale={locale} searchParams={searchParams} />
      </Suspense>
      <section
        id={CUSTOM_TRAINING_ID}
        aria-labelledby="custom-training-title"
        className={`${CONTAINER} mt-section grid scroll-mt-24 gap-8 md:grid-cols-12 md:gap-gutter`}
      >
        <div className="flex flex-col gap-3 md:col-span-4">
          <h2 id="custom-training-title" className="type-h2 text-balance">
            {t("custom.title")}
          </h2>
          <p className="max-w-measure text-pretty text-ink-2 type-small">{t("custom.intro")}</p>
        </div>
        <div className="min-w-0 self-start md:col-span-8">
          {/* The form is a client component: it gets only its own namespace. */}
          <NextIntlClientProvider messages={{ Training }}>
            <CustomRequestForm />
          </NextIntlClientProvider>
        </div>
      </section>
    </main>
  );
}
