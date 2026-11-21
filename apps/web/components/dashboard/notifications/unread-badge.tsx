import { cx } from "@/components/ui/cx";

/** Above this the badge shows "99+"; its text alternative keeps the number. */
export const BADGE_MAX = 99;

/**
 * The unread counter (§6.21). Nothing at zero. `text` is what is seen, such
 * as "3"; `label` is read instead, such as "3 unread notifications".
 */
export function UnreadBadge({
  count,
  text,
  label,
  className,
}: {
  count: number;
  text: string;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      data-unread-badge=""
      className={cx(
        // The AppShell board's count: a small square of ink with the page ground's color for the digits.
        "inline-flex h-5 min-w-5.5 shrink-0 items-center justify-center bg-ink px-1.5 text-xs font-medium text-bg tabular-nums",
        className,
      )}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
