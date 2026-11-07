import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * `neutral` for a draft or an inactive state, `strong` for published or
 * active, `danger` for something that needs attention.
 */
export type BadgeTone = "neutral" | "strong" | "danger";

// `strong` inverts text and background, so it reads in both themes without a
// new color. Gold is left out: badges are text.
const TONES: Record<BadgeTone, string> = {
  neutral: "border border-text/30 text-text-secondary",
  strong: "bg-text text-background",
  danger: "border border-danger text-danger",
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
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
