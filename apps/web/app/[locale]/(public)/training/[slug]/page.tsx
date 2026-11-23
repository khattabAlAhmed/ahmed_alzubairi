import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LanguageFallback } from "@/components/language-switch";
import { formatDate, metaSeparator } from "@/components/public/home/format";
import { SeatsMeter } from "@/components/public/listing";
import { CONTAINER, PageHero, TextBlock } from "@/components/public/parts";
import { ProjectFacts, type ProjectFact } from "@/components/public/projects/project-detail";
import { routeSlug, staticSlugs } from "@/components/public/static-slugs";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Skeleton } from "@/components/ui";
import { LocalDateTime } from "@/components/training/local-date-time";
import { TRAINING_PATH } from "@/components/training/paths";
import { RegistrationFrame, RegistrationPanel } from "@/components/training/registration-panel";
import { otherLocale, routing } from "@/i18n/routing";
import { getCourse } from "@/lib/content/courses";
import { metaDescription, pageMetadata } from "@/lib/seo";
import { defaultShareImage } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * A placeholder only: Cache Components needs one static param, and the build
 * must never read Supabase. Real slugs render on their first request.
 */
export function generateStaticParams() {
  return staticSlugs([]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  await connection();
  const course = await getCourse(routeSlug(slug), locale);
  if (!course) return {};
  return pageMetadata({
    locale,
    path: `${TRAINING_PATH}/${encodeURIComponent(course.slug)}`,
    title: course.title,
    description: metaDescription(course.description),
    image: await defaultShareImage(locale),
    languages: course.availableIn,
  });
}

/**
 * A course (§6.7). The course itself is public and cached by tag. Only the
 * registration panel reads the session, inside Suspense: it shows the
 * register button, "اكتملت المقاعد", or the registered state with the live
 * session's link. That link is never part of the public content.
 */
export default async function CoursePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const course = await getCourse(routeSlug(slug), locale);
  if (!course) notFound();
  const [t, tListing, { Training }] = await Promise.all([
    getTranslations({ locale, namespace: "Training" }),
    getTranslations({ locale, namespace: "PublicListing" }),
    getMessages({ locale }),
  ]);
  const recorded = course.type === "recorded";
  const online = course.type === "online_live";

  const date = course.startsAt ? (
    <NextIntlClientProvider locale={locale} messages={{}}>
      <LocalDateTime value={course.startsAt} fallback={formatDate(course.startsAt, locale)} />
    </NextIntlClientProvider>
  ) : (
    t("course.dateNotSet")
  );
  const typeLabel = recorded
    ? `${tListing("courseType.recorded")}${metaSeparator(locale)}${tListing("comingSoon")}`
    : tListing(`courseType.${course.type}`);
  const facts: ProjectFact[] = [
    { label: t("course.type"), value: typeLabel },
    ...(recorded ? [] : [{ label: t("course.date"), value: date }]),
    ...(!recorded && (online || course.place) ? [{ label: t("course.place"), value: online ? t("course.online") : course.place }] : []),
    ...(course.audience ? [{ label: t("course.for"), value: course.audience }] : []),
  ];
  const seats = course.seats !== null && course.seatsLeft !== null;

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      {/* No translation: the switch goes to the training page instead (§6.1). */}
      {!course.availableIn.includes(otherLocale(locale)) && <LanguageFallback href={TRAINING_PATH} />}
      <PageHero back={{ href: TRAINING_PATH, label: t("course.back") }} eyebrow={typeLabel} title={course.title} />
      <div className={`${CONTAINER} grid gap-10 md:grid-cols-12 md:gap-gutter`}>
        <div className="flex min-w-0 flex-col gap-12 md:col-span-7 lg:col-span-8">
          <ProjectFacts facts={facts} />
          <section aria-labelledby="course-about">
            <h2 id="course-about" className="mb-2 text-ink-2 type-small">
              {t("course.about")}
            </h2>
            <div className="border-t-2 border-rule pt-4">
              <div className="max-w-measure">
                <TextBlock text={course.description} />
              </div>
            </div>
          </section>
        </div>

        <aside aria-labelledby="course-registration" className="md:col-span-5 lg:col-span-4">
          <h2 id="course-registration" className="sr-only">
            {t("course.registration")}
          </h2>
          <RegistrationFrame
            className="md:sticky md:top-24"
            facts={[
              ...(recorded ? [] : [{ label: t("course.date"), value: date }]),
              ...(!recorded && course.type !== "custom"
                ? [{ label: t("course.seats"), value: seats ? null : t("course.noLimit") }]
                : []),
            ].filter((fact) => fact.value !== null)}
          >
            {!recorded && course.type !== "custom" && seats && (
              <SeatsMeter left={course.seatsLeft ?? 0} total={course.seats ?? 0} />
            )}
            <Suspense fallback={<Skeleton className="h-11 w-full" />}>
              {/* The button is a client component: it gets only its own namespace. */}
              <NextIntlClientProvider locale={locale} messages={{ Training }}>
                <RegistrationPanel course={course} locale={locale} />
              </NextIntlClientProvider>
            </Suspense>
          </RegistrationFrame>
        </aside>
      </div>
    </main>
  );
}
