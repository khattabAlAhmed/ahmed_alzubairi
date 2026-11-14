"use client";

import type { ConsultationStatus } from "@repo/shared";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import type { DocumentRequestStatus } from "./format";

export type StatusPillProps =
  | { kind: "consultation"; status: ConsultationStatus; className?: string }
  | { kind: "documentRequest"; status: DocumentRequestStatus; className?: string };

type Tone = "attention" | "active" | "done" | "ended";

/**
 * Waiting on the team reads strongest, work under way gets a gold dot (gold as
 * an icon, never text, §13), and finished states step back. The label always
 * carries the meaning; the look only helps scanning.
 */
const TONES: Record<ConsultationStatus | DocumentRequestStatus, Tone> = {
  new: "attention",
  pending_review: "attention",
  in_review: "active",
  in_progress: "active",
  scheduled: "active",
  in_contact: "active",
  granted: "done",
  closed: "ended",
  expired: "ended",
  revoked: "ended",
};

const LOOK: Record<Tone, { pill: string; dot: string | null }> = {
  attention: { pill: "bg-text text-background", dot: null },
  active: { pill: "border border-text/40 text-text", dot: "bg-accent" },
  done: { pill: "border border-text/40 text-text", dot: "bg-text" },
  ended: { pill: "border border-dashed border-text/40 text-text-secondary", dot: null },
};

/** A consultation (§6.17) or document request (§6.18) status, labelled in the UI language. */
export function StatusPill(props: StatusPillProps) {
  const t = useTranslations("Workspace.status");
  const label =
    props.kind === "consultation"
      ? t(`consultation.${props.status}`)
      : t(`documentRequest.${props.status}`);
  const look = LOOK[TONES[props.status]];

  return (
    <span
      data-status={props.status}
      className={cx(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap",
        look.pill,
        props.className,
      )}
    >
      {look.dot && <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", look.dot)} />}
      {label}
    </span>
  );
}
