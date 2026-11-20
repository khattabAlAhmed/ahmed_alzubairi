"use client";

import type { ConsultationStatus, DocumentRequestStatus } from "@repo/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type StatusPillProps =
  | { kind: "consultation"; status: ConsultationStatus; className?: string }
  | { kind: "documentRequest"; status: DocumentRequestStatus; className?: string };

type Tone = "info" | "warning" | "accent" | "success" | "danger" | "muted";

/*
 * The StatusPill board: a glyph and a word, never color alone. Each status
 * has its own glyph shape, so two statuses that share a color still differ
 * (success and danger also share lightness, DESIGN.md "Colour"). The word is
 * ink; only the glyph takes the status color.
 */
const DOT = (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <circle cx="7" cy="7" r="4" fill="currentColor" />
  </svg>
);
const CLOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const HALF = (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x="1.5" y="7" width="11" height="5.5" fill="currentColor" />
  </svg>
);
const CALENDAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 6h16v14H4zM4 10h16M9 3v5M15 3v5" />
  </svg>
);
const FILLED = (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <rect x="2" y="2" width="10" height="10" fill="currentColor" />
  </svg>
);
const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const HOLLOW = (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const CROSS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const LOOK: Record<ConsultationStatus | DocumentRequestStatus, { tone: Tone; glyph: ReactNode }> = {
  new: { tone: "info", glyph: DOT },
  in_review: { tone: "warning", glyph: CLOCK },
  in_progress: { tone: "accent", glyph: HALF },
  scheduled: { tone: "accent", glyph: CALENDAR },
  closed: { tone: "muted", glyph: FILLED },
  pending_review: { tone: "warning", glyph: CLOCK },
  in_contact: { tone: "info", glyph: DOT },
  granted: { tone: "success", glyph: CHECK },
  expired: { tone: "muted", glyph: HOLLOW },
  revoked: { tone: "danger", glyph: CROSS },
};

const GLYPH_COLOR: Record<Tone, string> = {
  info: "text-info",
  warning: "text-warning",
  accent: "text-accent",
  success: "text-success",
  danger: "text-danger",
  muted: "text-ink-2",
};

/** A consultation (§6.17) or document request (§6.18) status, labelled in the UI language. */
export function StatusPill(props: StatusPillProps) {
  const t = useTranslations("Workspace.status");
  const label =
    props.kind === "consultation"
      ? t(`consultation.${props.status}`)
      : t(`documentRequest.${props.status}`);
  const look = LOOK[props.status];

  return (
    <span
      data-status={props.status}
      data-tone={look.tone}
      className={cx(
        "inline-flex max-w-full items-center gap-2 text-sm leading-[1.6] whitespace-nowrap",
        look.tone === "muted" ? "text-ink-2" : "text-ink",
        props.className,
      )}
    >
      <span className={cx("size-3.5 shrink-0 [&>svg]:size-full", GLYPH_COLOR[look.tone])}>{look.glyph}</span>
      {label}
    </span>
  );
}
