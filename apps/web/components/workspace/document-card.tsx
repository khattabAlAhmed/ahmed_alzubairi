"use client";

import type { DocumentAccessMode, DocumentCategory, DocumentRequestStatus } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { DownloadIcon, EyeIcon } from "./icons";
import { StatusPill } from "./status-pill";
import { metaSeparator } from "@/components/public/home/format";

export type DocumentCardProps = {
  title: string;
  category: DocumentCategory;
  /** عرض فقط or عرض وتحميل (§6.18). */
  accessMode: DocumentAccessMode;
  /** The member's request status, when there is one. */
  status?: DocumentRequestStatus;
  /** Optional line under the title, such as an expiry date. */
  note?: ReactNode;
  /** Buttons: "Request to view", "View", "Download", "Grant". */
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

/**
 * One protected document (§6.18), as a row of the DocumentViewer board's
 * list: category, title and status on top, then the access mode and its note
 * (an expiry, say), and the action at the end. Rows sit under one heavy rule
 * in the caller's list, with a hairline under each.
 */
export function DocumentCard({
  title,
  category,
  accessMode,
  status,
  note,
  actions,
  headingLevel = 3,
  className,
}: DocumentCardProps) {
  const t = useTranslations("Workspace.document");
  const locale = useLocale();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article
      className={cx(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 border-b border-line py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[13px] text-ink-2">
          <span className="sr-only">{t("category")}: </span>
          {t(`categories.${category}`)}
        </p>
        {/* Text, never HTML (§9). */}
        <Heading className="font-medium text-balance wrap-anywhere type-small">{title}</Heading>
      </div>
      <div className="justify-self-end">{status && <StatusPill kind="documentRequest" status={status} />}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[1.7] text-ink-2">
        <p className="flex items-center gap-1.5">
          {accessMode === "view" ? <EyeIcon className="size-4" /> : <DownloadIcon className="size-4" />}
          <span className="sr-only">{t("access")}: </span>
          {t(`accessModes.${accessMode}`)}
        </p>
        {note && (
          <>
            <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
            <div>{note}</div>
          </>
        )}
      </div>
      {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : <span />}
    </article>
  );
}
