import { getTranslations } from "next-intl/server";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { Card } from "@/components/ui";
import { ACCESS_LOG_LIMIT, type AccessLogEntry } from "./data";

/**
 * Who opened a document and when (§6.18 "Logged"). Shown only to members
 * with `document_requests.decide`; RLS returns no rows to anyone else.
 */
export async function AccessLog({
  entries,
  locale,
  scope,
}: {
  entries: AccessLogEntry[];
  locale: string;
  scope: "document" | "request";
}) {
  const t = await getTranslations("DashboardDocuments.log");

  return (
    <Card as="section" aria-labelledby={`access-log-${scope}`}>
      <h2 id={`access-log-${scope}`} className="text-xl">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        {scope === "document" ? t("intro") : t("requestIntro")}
      </p>
      {entries.length === 0 ? (
        <p className="mt-4">{t("empty")}</p>
      ) : (
        <>
          {/* A list, not a table: each row stays readable at 375 px. */}
          <ul className="mt-4 divide-y divide-text/10">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <p className="min-w-0 font-semibold wrap-anywhere">
                  <span className="sr-only">{t("who")}: </span>
                  {entry.clientName ? <bdi>{entry.clientName}</bdi> : t("noName")}
                </p>
                <p className="flex flex-wrap gap-x-3 text-sm text-text-secondary">
                  <span>
                    <span className="sr-only">{t("action")}: </span>
                    {t(`actions.${entry.action}`)}
                  </span>
                  <span>
                    <span className="sr-only">{t("when")}: </span>
                    <LocalTime value={entry.createdAt} locale={locale} />
                  </span>
                </p>
              </li>
            ))}
          </ul>
          {entries.length >= ACCESS_LOG_LIMIT && (
            <p className="mt-3 text-sm text-text-secondary">{t("limit", { count: ACCESS_LOG_LIMIT })}</p>
          )}
        </>
      )}
    </Card>
  );
}
