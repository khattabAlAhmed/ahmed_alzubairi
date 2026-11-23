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
      <section className="border border-ink/10 bg-surface p-6">
        <h2 className="text-xl">{t("emptyTitle")}</h2>
        <p className="mt-2 text-pretty text-ink-2">{t("emptyText")}</p>
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
          {/* No aria-label: the card's visible text names the link, so the name
              matches what people see and say (WCAG 2.5.3, axe label-content-name-mismatch). */}
          <Link
            href={`/account/consultations/${item.id}`}
            className={cx(
              "block border border-ink/10 bg-surface p-4 transition-colors hover:border-ink/30 motion-reduce:transition-none",
              FOCUS_RING,
            )}
          >
            {/* On a phone the status sits above the title, so a long title gets the card's full width. */}
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
              <StatusPill kind="consultation" status={item.status} className="sm:order-last" />
              {/* Text, never HTML (§9). */}
              <h2 dir="auto" className="w-full min-w-0 text-start text-lg wrap-anywhere sm:w-auto sm:flex-1">
                {item.title}
              </h2>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-ink-2">{t("service")}</dt>
                <dd className="font-semibold wrap-anywhere">{item.serviceTitle ?? t("noService")}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-2">{t("lastActivity")}</dt>
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
