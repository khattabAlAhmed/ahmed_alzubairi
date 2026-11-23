import type { AdminCourse, Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { coursePagePath, courseTitle, registrationsPath, SCHEDULED_TYPES } from "./format";
import { LocalTime } from "./local-time";
import { PublishToggle } from "./publish-toggle";

/**
 * The courses (§6.20 Training): status, type, date and seats taken out of
 * the total, with the way in to edit one and see its registrations. Each row
 * is a small block, not a table row, so it fits a phone. Every value is
 * rendered as text.
 */
export function CourseList({ courses, locale }: { courses: AdminCourse[]; locale: Locale }) {
  const t = useTranslations("DashboardTraining");

  return (
    <ul className="divide-y divide-ink/10 border border-ink/10 bg-surface">
      {courses.map((course) => {
        const title = courseTitle(course, locale) ?? t("list.noTitle");
        const other = locale === "ar" ? course.titleEn : course.titleAr;
        const showOther = other && other.trim() !== title;
        return (
          <li key={course.id} className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold wrap-anywhere">
                  <Link
                    href={coursePagePath(course.id)}
                    aria-label={t("list.edit", { title })}
                    className="hover:underline"
                  >
                    <bdi>{title}</bdi>
                  </Link>
                </h2>
                {showOther && (
                  <p className="text-sm text-ink-2 wrap-anywhere">
                    <span className="sr-only">{t("list.otherTitle")}: </span>
                    <bdi lang={locale === "ar" ? "en" : "ar"}>{other}</bdi>
                  </p>
                )}
              </div>
              <Badge tone={course.status === "published" ? "strong" : "neutral"} className="self-start">
                {t(`status.${course.status}`)}
              </Badge>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm text-ink-2 sm:grid-cols-3">
              <div className="flex flex-wrap gap-x-1">
                <dt>{t("list.type")}:</dt>
                <dd className="text-ink">{t(`types.${course.type}`)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-1">
                <dt>{t("list.date")}:</dt>
                <dd className="text-ink">
                  {course.type === "recorded" ? (
                    t("list.noDateRecorded")
                  ) : course.startsAt ? (
                    <LocalTime value={course.startsAt} />
                  ) : (
                    t("list.noDate")
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-1">
                <dt>{t("list.seats")}:</dt>
                <dd className="text-ink">
                  {SCHEDULED_TYPES.includes(course.type) && course.seats !== null
                    ? t("list.seatsTaken", { taken: course.registrationCount, total: course.seats })
                    : t("list.registered", { count: course.registrationCount })}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={registrationsPath({ course: course.id })}
                className="text-sm font-semibold underline-offset-4 hover:underline"
                aria-label={t("list.registrationsLabel", { title, count: course.registrationCount })}
              >
                {t("list.registrations", { count: course.registrationCount })}
              </Link>
              <PublishToggle id={course.id} title={title} status={course.status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
