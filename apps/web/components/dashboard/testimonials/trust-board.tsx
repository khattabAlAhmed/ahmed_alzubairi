"use client";

import type { Locale } from "@repo/shared";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge, Button, ButtonLink, Card, SectionHeading } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import type { RefOption } from "../content/field-text";
import { rowStatus, rowTitle, type Row } from "../content/form-values";
import { newPath } from "../content/registry";
import { mediaUrl } from "../content/upload";
import { sendApproval } from "./approval";
import { trustBlockers, type TrustRow, type TrustType } from "./rows";
import { TrustEditor } from "./trust-editor";

export type TrustBoardProps = {
  testimonials: TrustRow[];
  partners: TrustRow[];
  partnerOptions: RefOption[];
  mediaBase: string;
  /** `content.manage`, checked on the server: edit, add, upload. */
  canEdit: boolean;
  /** `testimonials.approve`, checked on the server: approve and withdraw. */
  canApprove: boolean;
};

type Notice = { tone: "status" | "alert"; text: string };

/** A localized text in its own language and direction, or nothing. */
function Localized({ row, field, locale }: { row: Row; field: string; locale: Locale }) {
  const name = `${field}${locale === "ar" ? "Ar" : "En"}`;
  const value = row[name];
  if (typeof value !== "string" || value.trim() === "") return null;
  return (
    <p lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="text-sm">
      {value}
    </p>
  );
}

function TrustItem({
  type,
  item,
  partnerOptions,
  mediaBase,
  canEdit,
  canApprove,
  onNotice,
}: {
  type: TrustType;
  item: TrustRow;
  partnerOptions: RefOption[];
  mediaBase: string;
  canEdit: boolean;
  canApprove: boolean;
  onNotice: (notice: Notice) => void;
}) {
  const t = useTranslations("DashboardTrust");
  const tc = useTranslations("DashboardContent");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { row, hasLetter } = item;
  const id = String(row.id);
  const name = rowTitle(type, row, locale) ?? t("testimonials.untitled");
  const status = rowStatus(row);
  const consent = row.consentConfirmed === true;
  const approved = row.adminApproved === true;
  const blockers = trustBlockers(row);
  const partner =
    type === "testimonials"
      ? partnerOptions.find((option) => option.id === row.partnerId)
      : undefined;
  const logo = type === "partners" && typeof row.logoKey === "string" ? row.logoKey : "";

  async function decide(next: boolean) {
    if (busy) return;
    setBusy(true);
    const result = await sendApproval(type, id, next);
    setBusy(false);
    if (!result.ok) {
      onNotice({ tone: "alert", text: result.message ?? t("approval.failed") });
      return;
    }
    onNotice({
      tone: "status",
      text: next ? t("approval.approvedDone", { name }) : t("approval.withdrawnDone", { name }),
    });
    // Reload the rows, so the badges, the blockers and an open form see the change.
    router.refresh();
  }

  return (
    <Card as="li" compact className="space-y-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {logo && (
          <Image
            src={mediaUrl(mediaBase, logo)}
            alt=""
            width={96}
            height={48}
            className="h-12 w-24 rounded border border-text/10 bg-surface object-contain"
          />
        )}
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="text-lg">
            <bdi>{name}</bdi>
          </h3>
          {type === "testimonials" && (
            <p className="text-sm text-text-secondary">
              {partner ? (
                t.rich("testimonials.linkedTo", {
                  name: partner.title,
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })
              ) : (
                t("testimonials.noPartner")
              )}
            </p>
          )}
        </div>
      </div>
      <p className="flex flex-wrap gap-1.5">
        <Badge tone={status === "published" ? "strong" : "neutral"}>{tc(`status.${status}`)}</Badge>
        <Badge tone={consent ? "strong" : "neutral"}>
          {consent ? t("consent.confirmed") : t("consent.missing")}
        </Badge>
        <Badge tone={approved ? "strong" : "neutral"}>
          {approved ? t("approval.approved") : t("approval.pending")}
        </Badge>
      </p>
      {type === "testimonials" && (
        <div className="space-y-1">
          <Localized row={row} field="quote" locale="ar" />
          <Localized row={row} field="quote" locale="en" />
        </div>
      )}
      {blockers.length > 0 && (
        <div className="rounded-md border border-text/20 p-3 text-sm">
          <p className="font-semibold">{tc("editor.cantPublish")}</p>
          <ul className="mt-1 list-disc ps-5">
            {blockers.map((blocker) => (
              <li key={blocker}>{tc(`editor.problems.${blocker}`)}</li>
            ))}
          </ul>
        </div>
      )}
      {type === "testimonials" && (
        <div className="text-sm">
          <p>
            <span className="font-semibold">{t("letter.heading")}: </span>
            {hasLetter ? t("letter.attached") : t("letter.none")}
          </p>
          {hasLetter && (
            <p className="mt-1">
              <a
                // A route handler, not a page: a plain link, in a new tab.
                href={`/${locale}/dashboard/testimonials/letter?id=${encodeURIComponent(id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-4"
              >
                {t("letter.open")}
              </a>
              <span className="text-text-secondary"> {t("letter.openHint")}</span>
            </p>
          )}
        </div>
      )}
      {(canEdit || canApprove) && (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={open}
              aria-controls={formId}
              aria-label={
                open
                  ? t("testimonials.closeLabel", { name })
                  : t("testimonials.editLabel", { name })
              }
              onClick={() => setOpen((value) => !value)}
            >
              {open ? t("testimonials.close") : t("testimonials.edit")}
            </Button>
          )}
          {canApprove &&
            (approved ? (
              <Button
                variant="quiet"
                size="sm"
                loading={busy}
                aria-label={t("approval.withdrawLabel", { name })}
                onClick={() => void decide(false)}
              >
                {t("approval.withdraw")}
              </Button>
            ) : (
              <Button
                size="sm"
                loading={busy}
                aria-label={t("approval.approveLabel", { name })}
                onClick={() => void decide(true)}
              >
                {t("approval.approve")}
              </Button>
            ))}
        </div>
      )}
      {canApprove && approved && (
        <p className="text-sm text-text-secondary">{t("approval.withdrawNote")}</p>
      )}
      {!canApprove && !approved && (
        <p className="text-sm text-text-secondary">{t("approval.onlyAdmin")}</p>
      )}
      <div id={formId}>
        {canEdit && open && (
          <TrustEditor
            type={type}
            row={row}
            hasLetter={hasLetter}
            partnerOptions={partnerOptions}
            mediaBase={mediaBase}
          />
        )}
      </div>
    </Card>
  );
}

function TrustSection({
  type,
  items,
  props,
  onNotice,
}: {
  type: TrustType;
  items: TrustRow[];
  props: TrustBoardProps;
  onNotice: (notice: Notice) => void;
}) {
  const t = useTranslations("DashboardTrust.testimonials");
  const headingId = useId();
  const testimonials = type === "testimonials";

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <SectionHeading
        id={headingId}
        title={testimonials ? t("listHeading") : t("logosHeading")}
        actions={
          props.canEdit && (
            <ButtonLink href={newPath(type)} variant="secondary" size="sm">
              {testimonials ? t("addTestimonial") : t("addLogo")}
            </ButtonLink>
          )
        }
      />
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">{t("empty")}</p>
      ) : (
        <ul aria-labelledby={headingId} className="space-y-3">
          {items.map((item) => (
            <TrustItem
              key={String(item.row.id)}
              type={type}
              item={item}
              partnerOptions={props.partnerOptions}
              mediaBase={props.mediaBase}
              canEdit={props.canEdit}
              canApprove={props.canApprove}
              onNotice={onNotice}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Testimonials and logos (§6.11), each with its consent, its approval and,
 * for testimonials, its source letter. What a member can do comes from the
 * server's permission checks; the routes check again.
 */
export function TrustBoard(props: TrustBoardProps) {
  const [notice, setNotice] = useState<Notice | null>(null);

  return (
    <div className="space-y-10">
      <div aria-live="polite">
        {notice && (
          <p
            role={notice.tone}
            className={
              notice.tone === "alert"
                ? "text-sm font-semibold text-danger"
                : "text-sm font-semibold"
            }
          >
            {notice.text}
          </p>
        )}
      </div>
      <TrustSection type="testimonials" items={props.testimonials} props={props} onNotice={setNotice} />
      <TrustSection type="partners" items={props.partners} props={props} onNotice={setNotice} />
    </div>
  );
}
