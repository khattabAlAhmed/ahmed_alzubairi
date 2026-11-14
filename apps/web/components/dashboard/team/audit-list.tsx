import type { AuditLogEntry } from "@repo/shared";
import { getMessages, getTranslations } from "next-intl/server";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { LocalTime } from "./local-time";
import { actionLabel, entityLabel } from "./audit-labels";

/** One value of an entry's metadata, as plain text. Metadata holds ids and flags only. */
function metadataText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** The audit log's rows, newest first. Every value is rendered as text, never as HTML (§9). */
export async function AuditList({
  entries,
  locale,
}: {
  entries: AuditLogEntry[];
  locale: string;
}) {
  const [t, { DashboardTeam, DashboardContent }] = await Promise.all([
    getTranslations("DashboardTeam.audit"),
    getMessages(),
  ]);
  const { actions, entities } = DashboardTeam.audit;

  return (
    <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface shadow-sm">
      {entries.map((entry) => {
        const metadata = Object.entries(entry.metadata);
        return (
          <li key={entry.id} className="space-y-2 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <p className="min-w-0 break-words">
                <span className="font-semibold">
                  <bdi>{entry.actorName ?? t("unknownActor")}</bdi>
                </span>
                {" · "}
                {actionLabel(entry.action, actions)}
              </p>
              <p className="shrink-0 text-sm text-text-secondary">
                <LocalTime value={entry.createdAt} locale={locale} />
              </p>
            </div>
            <p className="text-sm wrap-anywhere text-text-secondary">
              {entityLabel(entry.entity, entities, DashboardContent.types)}
              {entry.entityId && (
                <>
                  {" · "}
                  {t("item")}: <bdi dir="ltr">{entry.entityId}</bdi>
                </>
              )}
            </p>
            {metadata.length > 0 && (
              <details className="text-sm">
                <summary
                  className={cx(
                    "w-fit cursor-pointer rounded-sm text-text-secondary hover:text-text",
                    FOCUS_RING,
                  )}
                >
                  {t("details")}
                </summary>
                <dl dir="ltr" className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-start">
                  {metadata.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="font-semibold">{key}</dt>
                      <dd className="wrap-anywhere">{metadataText(value)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
