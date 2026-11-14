"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui";
import { DocumentCard } from "@/components/workspace";
import { LocalTime } from "@/components/consultations/local-time";
import type { GroupedRequests, OwnRequest } from "./group";
import { chatPath, requestPath, viewerPath } from "./paths";

type Group = keyof GroupedRequests;

/**
 * One request on "وثائقي المتاحة", built on T02's DocumentCard and StatusPill:
 * "فتح" when available, the chat link when in contact, "طلب مجدداً" when ended.
 */
export function RequestCard({
  request,
  group,
  canRequestAgain = false,
}: {
  request: OwnRequest;
  group: Group;
  canRequestAgain?: boolean;
}) {
  const t = useTranslations("AccountDocuments");
  const date = (value: string) => <LocalTime value={value} withTime={false} />;

  const note =
    group === "available"
      ? request.expiresAt
        ? t.rich("expires", { date: () => date(request.expiresAt ?? "") })
        : t("noExpiry")
      : t.rich("requested", { date: () => date(request.createdAt) });

  let actions = null;
  if (group === "available") {
    actions = (
      <ButtonLink href={viewerPath(request.id)} size="sm" aria-label={t("openLabel", { title: request.title })}>
        {t("open")}
      </ButtonLink>
    );
  } else if (group === "inProgress" && request.status === "in_contact" && request.consultationId) {
    actions = (
      <ButtonLink href={chatPath(request.consultationId)} variant="secondary" size="sm">
        {t("chat")}
      </ButtonLink>
    );
  } else if (group === "ended" && canRequestAgain) {
    actions = (
      <ButtonLink
        href={requestPath([request.documentId])}
        variant="secondary"
        size="sm"
        aria-label={t("requestAgainLabel", { title: request.title })}
      >
        {t("requestAgain")}
      </ButtonLink>
    );
  }

  return (
    <DocumentCard
      title={request.title}
      category={request.category}
      accessMode={request.accessMode}
      // A grant past its expiry reads as expired even before the hourly job marks it.
      status={group === "ended" && request.status === "granted" ? "expired" : request.status}
      note={note}
      actions={actions}
      headingLevel={3}
      className="w-full"
    />
  );
}
