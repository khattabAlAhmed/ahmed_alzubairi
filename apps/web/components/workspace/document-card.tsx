"use client";

import type { DocumentAccessMode, DocumentCategory } from "@repo/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import type { DocumentRequestStatus } from "./format";
import { DownloadIcon, EyeIcon } from "./icons";
import { StatusPill } from "./status-pill";

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

/** One protected document (§6.18): title, category, access mode, request status and actions. */
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
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <Card as="article" compact className={cx("flex flex-col gap-3", className)}>
      {/* Category and status share the top row, so a long title gets the card's full width. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 text-xs font-semibold text-text-secondary">
          <span className="sr-only">{t("category")}: </span>
          {t(`categories.${category}`)}
        </p>
        {status && <StatusPill kind="documentRequest" status={status} />}
      </div>
      {/* Text, never HTML (§9). */}
      <Heading className="-mt-1 text-lg text-balance wrap-anywhere">{title}</Heading>
      {note && <div className="text-sm text-text-secondary">{note}</div>}
      <p className="flex items-center gap-1.5 text-sm text-text-secondary">
        {accessMode === "view" ? <EyeIcon /> : <DownloadIcon />}
        <span className="sr-only">{t("access")}: </span>
        {t(`accessModes.${accessMode}`)}
      </p>
      {actions && <div className="mt-auto flex flex-wrap gap-2 pt-1">{actions}</div>}
    </Card>
  );
}
