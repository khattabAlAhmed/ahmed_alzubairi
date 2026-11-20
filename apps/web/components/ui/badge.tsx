import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The Tag board: a hairline frame with no fill, small and quiet. Never the
 * only signal: a tag is always a word.
 *
 * - `neutral`: a category or a type ("Governance", "In person", "PDF").
 * - `soon`: "Coming soon", the only tag in the accent.
 * - `draft`: "Draft", a dashed frame.
 * - `strong`: published or active, filled with ink.
 * - `danger`: needs attention, in the danger color.
 *
 * Statuses of a consultation or a document request use StatusPill, not a tag.
 */
export type BadgeTone = "neutral" | "soon" | "draft" | "strong" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line-strong text-ink-2",
  soon: "border-accent text-accent",
  draft: "border-dashed border-line-strong text-ink-2",
  strong: "border-ink bg-ink text-bg",
  danger: "border-danger text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 border px-2 py-px text-xs leading-[1.8] whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The same component, by the design system's name. */
export { Badge as Tag, type BadgeTone as TagTone };
