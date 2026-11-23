import type { Locale } from "@repo/shared";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { CustomRequestRow } from "./data";
import { formatDateTime } from "@/lib/time/format";
import { clientPagePath } from "./format";
import { LocalTime } from "./local-time";

/** A calendar date with no time zone, shown as written. */
function calendarDate(value: string, locale: Locale): string {
  const at = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(at.getTime())
    ? value
    : formatDateTime(at, locale, { date: "long", time: false, timeZone: "UTC" });
}

/**
 * Custom training requests (§6.7, §6.20), newest first. Everything in them
 * was typed by a visitor, so every value is rendered as text, never as HTML.
 */
export function RequestList({ requests, locale }: { requests: CustomRequestRow[]; locale: Locale }) {
  const t = useTranslations("DashboardTraining.requests");
  const format = useFormatter();

  return (
    <ul className="divide-y divide-ink/10 border border-ink/10 bg-surface">
      {requests.map((row) => (
        <li key={row.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 className="min-w-0 text-base font-semibold wrap-anywhere">
              <bdi>{row.orgName}</bdi>
            </h2>
            <p className="text-sm text-ink-2">
              <span className="sr-only">{t("received")}: </span>
              <LocalTime value={row.createdAt} />
            </p>
          </div>
          <p className="whitespace-pre-line wrap-anywhere">
            <span className="sr-only">{t("topic")}: </span>
            <bdi>{row.topic}</bdi>
          </p>
          <dl className="grid gap-x-6 gap-y-1 text-sm text-ink-2 sm:grid-cols-2 xl:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1.5fr)]">
            <div className="flex flex-wrap gap-x-1">
              <dt>{t("trainees")}:</dt>
              <dd className="text-ink">{format.number(row.traineeCount)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-1">
              <dt>{t("suggestedDate")}:</dt>
              <dd className="text-ink">{calendarDate(row.suggestedDate, locale)}</dd>
            </div>
            <div className="flex min-w-0 flex-wrap gap-x-1">
              <dt>{t("place")}:</dt>
              <dd className="min-w-0 text-ink wrap-anywhere">{row.place ? <bdi>{row.place}</bdi> : t("noPlace")}</dd>
            </div>
            <div className="flex min-w-0 flex-wrap gap-x-1">
              <dt>{t("email")}:</dt>
              <dd className="min-w-0 text-ink wrap-anywhere">
                <bdi dir="ltr">{row.contactEmail}</bdi>
              </dd>
            </div>
          </dl>
          {row.clientId && (
            <Link href={clientPagePath(row.clientId)} className="inline-block text-sm font-semibold underline-offset-4 hover:underline">
              {t("openClient")}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
