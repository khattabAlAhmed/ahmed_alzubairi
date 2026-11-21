import { useLocale } from "next-intl";
import { cx } from "@/components/ui/cx";
import { localizeStatValue } from "./stat-value";

/**
 * A quick-stat value, static: the quick stats never count up (Ahmed's
 * decision, plan.md Phase 8; the QuietStat board). Tabular figures, in the
 * page's digits, and isolated left to right so "15+" doesn't turn into "+15"
 * in Arabic. It renders on the server and ships no script.
 */
export function StatNumber({ value, className }: { value: string; className?: string }) {
  const locale = useLocale();
  return (
    <span dir="ltr" className={cx("tabular-nums [unicode-bidi:isolate]", className)}>
      {localizeStatValue(value, locale)}
    </span>
  );
}
