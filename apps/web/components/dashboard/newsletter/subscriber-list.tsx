"use client";

import type { NewsletterStatus, NewsletterSubscriber } from "@repo/shared";
import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui";
import { LocalTime } from "@/components/consultations/local-time";

const TONES: Record<NewsletterStatus, BadgeTone> = {
  confirmed: "strong",
  pending: "neutral",
  unsubscribed: "danger",
};

/**
 * The subscriber rows (§6.15). Read only: a subscription changes through the
 * confirm link and the unsubscribe link, never from here. Each row is a small
 * block, not a table row, so it fits a phone.
 */
export function SubscriberList({ subscribers }: { subscribers: NewsletterSubscriber[] }) {
  const t = useTranslations("DashboardNewsletter");

  return (
    <ul className="divide-y divide-ink/10 border border-ink/15 bg-surface">
      {subscribers.map((subscriber) => (
        <li key={subscriber.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* An address reads left to right in both languages, and may be long. */}
            <p className="min-w-0 font-semibold text-ink wrap-anywhere">
              <span className="sr-only">{t("row.email")}: </span>
              <bdi dir="ltr">{subscriber.email}</bdi>
            </p>
            <Badge tone={TONES[subscriber.status]}>{t(`statuses.${subscriber.status}`)}</Badge>
          </div>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-ink-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-wrap gap-x-1">
              <dt>{t("row.source")}:</dt>
              <dd className="text-ink">{t(`sources.${subscriber.source}`)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-1">
              <dt>{t("row.language")}:</dt>
              <dd className="text-ink">{t(`languages.${subscriber.locale}`)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-1">
              <dt>{t("row.signedUp")}:</dt>
              <dd className="text-ink">
                <LocalTime value={subscriber.createdAt} />
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-1">
              <dt>{t("row.consented")}:</dt>
              <dd className="text-ink">
                {subscriber.consentedAt ? <LocalTime value={subscriber.consentedAt} /> : t("row.none")}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
