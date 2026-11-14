import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { StatusPill } from "@/components/workspace";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "./local-time";
import { NEW_CONSULTATION_PATH } from "./paths";
import type { ConsultationRow } from "./read";

export const NEW_CONSULTATION_HREF = NEW_CONSULTATION_PATH;

/** "استشاراتي" (§6.17): each consultation with its service, status and last activity, or the empty state. */
export function ConsultationList({ consultations }: { consultations: ConsultationRow[] }) {
  const t = useTranslations("AccountConsultations.list");

  if (consultations.length === 0) {
    return (
      <section className="rounded-lg border border-text/10 bg-surface p-6 shadow-sm">
        <h2 className="text-xl">{t("emptyTitle")}</h2>
        <p className="mt-2 text-text-secondary">{t("emptyText")}</p>
        <ButtonLink href={NEW_CONSULTATION_HREF} className="mt-4">
          {t("new")}
        </ButtonLink>
      </section>
    );
  }

  return (
    <ul aria-label={t("label")} className="space-y-3">
      {consultations.map((item) => (
        <li key={item.id}>
          <Link
            href={`/account/consultations/${item.id}`}
            aria-label={t("open", { title: item.title })}
            className={cx(
              "block rounded-lg border border-text/10 bg-surface p-4 shadow-sm transition-colors hover:border-text/30 motion-reduce:transition-none",
              FOCUS_RING,
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Text, never HTML (§9). */}
              <h2 dir="auto" className="min-w-0 flex-1 text-start text-lg wrap-anywhere">
                {item.title}
              </h2>
              <StatusPill kind="consultation" status={item.status} />
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-text-secondary">{t("service")}</dt>
                <dd className="font-semibold wrap-anywhere">{item.serviceTitle ?? t("noService")}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">{t("lastActivity")}</dt>
                <dd className="font-semibold">
                  <LocalTime value={item.lastActivityAt} />
                </dd>
              </div>
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}
