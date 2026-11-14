import type { AdminDocumentRequest, Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AccessLog } from "@/components/dashboard/documents/access-log";
import type { AccessLogEntry } from "@/components/dashboard/documents/data";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { ButtonLink, Card } from "@/components/ui";
import { StatusPill } from "@/components/workspace";
import { DecideControls } from "./decide-controls";
import { RecommendForm } from "./recommend-form";

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

/** The request's document title in the UI language, or a stand-in when it's hidden. */
export function requestTitle(request: AdminDocumentRequest, locale: Locale): string {
  return locale === "ar" ? request.documentTitleAr : request.documentTitleEn;
}

const OPEN = new Set(["pending_review", "in_contact"]);

/**
 * One document request (§6.18, §6.20): client, document, purpose,
 * recommendations, then the recommend form (open requests) and, for
 * `document_requests.decide` only, the decision and the access log. Must sit
 * inside a provider with `DashboardDocumentRequests` and `Workspace`.
 */
export async function RequestDetail({
  request,
  locale,
  canDecide,
  log,
}: {
  request: AdminDocumentRequest;
  locale: Locale;
  canDecide: boolean;
  log: AccessLogEntry[] | null;
}) {
  const t = await getTranslations("DashboardDocumentRequests");
  const title = requestTitle(request, locale) || t("list.noTitle");
  const client = request.clientName || t("list.noName");
  const open = OPEN.has(request.status);

  return (
    <div className="space-y-6">
      {/* Every value is rendered as text, never as HTML (§9). */}
      <Card as="section" aria-labelledby="request-summary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="request-summary" className="min-w-0 text-xl wrap-anywhere">
            {title}
          </h2>
          <StatusPill kind="documentRequest" status={request.status} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("detail.client")}>
            <bdi>{client}</bdi>
          </Field>
          <Field label={t("detail.requested")}>
            <LocalTime value={request.createdAt} locale={locale} />
          </Field>
          <Field label={t("detail.purpose")} wide>
            <span className="whitespace-pre-line">{request.purpose}</span>
          </Field>
          {request.grantedAt && (
            <Field label={t("detail.granted")}>
              <LocalTime value={request.grantedAt} locale={locale} />
            </Field>
          )}
          {request.status === "granted" && (
            <Field label={t("detail.expires")}>
              {request.expiresAt ? (
                <LocalTime value={request.expiresAt} locale={locale} />
              ) : (
                t("detail.noExpiry")
              )}
            </Field>
          )}
          {request.revokedAt && (
            <Field label={t("detail.revoked")}>
              <LocalTime value={request.revokedAt} locale={locale} />
            </Field>
          )}
        </dl>
        {request.status === "in_contact" && request.consultationId && (
          <div className="mt-4 space-y-2 border-t border-text/10 pt-4">
            <p className="text-sm text-text-secondary">{t("detail.chatHint")}</p>
            <ButtonLink
              href={`/dashboard/consultations/${encodeURIComponent(request.consultationId)}`}
              variant="secondary"
              size="sm"
            >
              {t("detail.chat")}
            </ButtonLink>
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="request-recommendations">
        <h2 id="request-recommendations" className="text-xl">
          {t("detail.recommendations")}
        </h2>
        {request.recommendations.length === 0 ? (
          <p className="mt-3 text-text-secondary">{t("detail.noRecommendations")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-text/10">
            {request.recommendations.map((rec) => (
              <li key={rec.id} className="space-y-1 py-3">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{t(`recommendation.${rec.recommendation}`)}</span>
                  <span className="text-sm text-text-secondary">
                    <bdi>{rec.memberName || t("detail.noMember")}</bdi> ·{" "}
                    <LocalTime value={rec.createdAt} locale={locale} />
                  </span>
                </p>
                {rec.note && <p className="max-w-prose whitespace-pre-line wrap-anywhere">{rec.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && (
        <Card as="section" aria-labelledby="request-recommend">
          <h2 id="request-recommend" className="text-xl">
            {t("recommend.title")}
          </h2>
          <p className="mt-1 mb-4 text-sm text-text-secondary">{t("recommend.intro")}</p>
          <RecommendForm requestId={request.id} />
        </Card>
      )}

      {canDecide && (
        <Card as="section" aria-labelledby="request-decide">
          <h2 id="request-decide" className="mb-2 text-xl">
            {request.status === "granted" ? t("decide.withdrawTitle") : t("decide.title")}
          </h2>
          <DecideControls
            requestId={request.id}
            status={request.status}
            clientName={client}
            documentTitle={title}
          />
        </Card>
      )}

      {canDecide && log && <AccessLog entries={log} locale={locale} scope="request" />}
    </div>
  );
}
