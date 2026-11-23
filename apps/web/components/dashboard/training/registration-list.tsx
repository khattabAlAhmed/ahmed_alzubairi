import type { Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { RegistrationRow } from "./data";
import { clientPagePath, coursePagePath, courseTitle } from "./format";
import { LocalTime } from "./local-time";

/**
 * Registered clients (§6.20 Training): name, email, date and course, with a
 * link to the client's page. Every value is rendered as text.
 */
export function RegistrationList({
  registrations,
  locale,
  showCourse,
}: {
  registrations: RegistrationRow[];
  locale: Locale;
  /** False when the list is one course's: the course is in the heading. */
  showCourse: boolean;
}) {
  const t = useTranslations("DashboardTraining.registrations");

  return (
    <ul className="divide-y divide-ink/10 border border-ink/10 bg-surface">
      {registrations.map((row) => {
        const name = row.name?.trim() || t("unknownClient");
        const course = courseTitle({ titleAr: row.courseTitleAr, titleEn: row.courseTitleEn }, locale) ?? t("noTitle");
        return (
          <li key={row.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="min-w-0 font-semibold wrap-anywhere">
                {row.name ? (
                  <Link href={clientPagePath(row.clientId)} className="hover:underline" aria-label={t("openClient", { name })}>
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </p>
              <p className="text-sm text-ink-2">
                <span className="sr-only">{t("date")}: </span>
                <LocalTime value={row.createdAt} />
              </p>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm text-ink-2 sm:grid-cols-2">
              {row.email && (
                <div className="flex min-w-0 flex-wrap gap-x-1">
                  <dt>{t("email")}:</dt>
                  {/* An address reads left to right in both languages, and may be long. */}
                  <dd className="min-w-0 text-ink wrap-anywhere">
                    <bdi dir="ltr">{row.email}</bdi>
                  </dd>
                </div>
              )}
              {showCourse && (
                <div className="flex min-w-0 flex-wrap gap-x-1">
                  <dt>{t("course")}:</dt>
                  <dd className="min-w-0 text-ink wrap-anywhere">
                    <Link href={coursePagePath(row.courseId)} className="hover:underline">
                      <bdi>{course}</bdi>
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
