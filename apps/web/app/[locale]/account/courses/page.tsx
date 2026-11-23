import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/components/public/home/format";
import { readMyCourses } from "@/components/training/data";
import { LocalDateTime } from "@/components/training/local-date-time";
import { coursePath, TRAINING_PATH } from "@/components/training/paths";
import { Badge, buttonClasses, ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth/gates";
import { pageLocale } from "../consultations/locale";

/**
 * "دوراتي" (§6.7): the client's own course registrations, with each course's
 * date, place and, for a live online course, its link. Read with the client's
 * own token; see `readMyCourses`.
 */
export default async function MyCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireProfile(params, "/account/courses");
  const locale = pageLocale((await params).locale);
  const [{ userId }, t, tListing] = await Promise.all([
    auth(),
    getTranslations("Training.account"),
    getTranslations("PublicListing"),
  ]);
  if (!userId) throw new Error("no session after the gate");
  const courses = await readMyCourses(userId, locale);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          courses.length > 0 && (
            <ButtonLink href={TRAINING_PATH} variant="secondary">
              {t("browse")}
            </ButtonLink>
          )
        }
      />
      {courses.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-prose text-ink-2">{t("emptyText")}</p>
          <ButtonLink href={TRAINING_PATH} className="mt-4">
            {t("browse")}
          </ButtonLink>
        </Card>
      ) : (
        // Dates are filled in by the browser, in the viewer's time zone.
        <NextIntlClientProvider locale={locale} messages={{}}>
          <ul className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Card as="li" key={course.id} className="flex flex-col">
                <div>
                  <Badge>{tListing(`courseType.${course.type}`)}</Badge>
                </div>
                <h2 className="mt-3 text-xl leading-snug">{course.title}</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="font-semibold text-ink-2">{t("date")}</dt>
                    <dd className="mt-0.5">
                      {course.startsAt ? (
                        <LocalDateTime
                          value={course.startsAt}
                          fallback={formatDate(course.startsAt, locale)}
                        />
                      ) : (
                        t("dateNotSet")
                      )}
                    </dd>
                  </div>
                  {(course.place || course.type === "online_live") && (
                    <div>
                      <dt className="font-semibold text-ink-2">{t("place")}</dt>
                      <dd className="mt-0.5">
                        {course.type === "online_live" ? t("online") : course.place}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-semibold text-ink-2">{t("registeredOn")}</dt>
                    <dd className="mt-0.5">
                      <LocalDateTime
                        value={course.registeredAt}
                        fallback={formatDate(course.registeredAt, locale)}
                        dateOnly
                      />
                    </dd>
                  </div>
                </dl>
                {(course.onlineUrl || course.slug) && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {course.onlineUrl && (
                      <a
                        href={course.onlineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClasses({})}
                      >
                        {t("openLink")}
                        <span className="sr-only"> {t("opensInNewTab")}</span>
                      </a>
                    )}
                    {course.slug && (
                      <ButtonLink href={coursePath(course.slug)} variant="secondary">
                        {t("view")}
                      </ButtonLink>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </ul>
        </NextIntlClientProvider>
      )}
    </div>
  );
}
