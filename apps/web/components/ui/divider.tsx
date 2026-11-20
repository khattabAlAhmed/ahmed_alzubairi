import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The Divider board, the one way sections and items are separated when space
 * alone isn't enough.
 *
 * - `heavy`: the 2px `rule` that opens a section, a record, the header or a
 *   dialog. It opens; it never closes or boxes anything.
 * - `hair`: the 1px `line` between rows inside a record.
 *
 * Decorative: screen readers skip it, since the headings carry the structure.
 */
export function Divider({ variant = "hair", className }: { variant?: "heavy" | "hair"; className?: string }) {
  return (
    <hr
      aria-hidden="true"
      className={cx(
        "m-0 border-0 border-t",
        variant === "heavy" ? "border-t-2 border-rule" : "border-line",
        className,
      )}
    />
  );
}

/**
 * A dated rule: a month or a day between two hairlines, separating messages
 * or a timeline. Pass the date already formatted (formatDate, or a `<time>`).
 */
export function DatedDivider({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cx(
        "flex items-center gap-3 text-[13px] text-ink-2",
        "before:flex-1 before:border-t before:border-line before:content-[''] after:flex-1 after:border-t after:border-line after:content-['']",
        className,
      )}
    >
      {children}
    </p>
  );
}
