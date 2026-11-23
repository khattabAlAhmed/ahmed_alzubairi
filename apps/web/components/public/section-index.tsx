import type { Locale } from "@repo/shared";
import { useLocale } from "next-intl";
import { formatNumber } from "@/components/public/home/format";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

export type SectionIndexItem = {
  label: string;
  /** "#id" for a part of this page, or a site path ("/terms"). */
  href: string;
  /** How many items the section holds, shown at the end of the row. */
  count?: number;
  /** The page or section the reader is on (aria-current). */
  current?: boolean;
};

const ROW =
  "flex justify-between gap-3 border-b border-line py-2.5 text-[15px] text-ink-2 no-underline transition-state hover:text-ink focus-ring focus-visible:-outline-offset-2 aria-[current]:font-medium aria-[current]:text-ink";

/**
 * The side index (Legal and FAQ boards): a heavy rule, then one row per
 * section with hairlines between, an optional count at the end. The current
 * row is set in ink and marked with `aria-current`. The caller places it on
 * the grid through `className`.
 */
export function SectionIndex({
  label,
  items,
  className,
}: {
  /** The navigation's accessible name. */
  label: string;
  items: readonly SectionIndexItem[];
  className?: string;
}) {
  const locale = useLocale() as Locale;
  return (
    <nav aria-label={label} className={cx("border-t-2 border-rule", className)}>
      <ul>
        {items.map((item, index) => {
          const content = (
            <>
              {item.label}
              {item.count !== undefined && <span className="tabular-nums">{formatNumber(item.count, locale)}</span>}
            </>
          );
          const props = {
            className: ROW,
            "aria-current": item.current ? (item.href.startsWith("#") ? ("true" as const) : ("page" as const)) : undefined,
          };
          return (
            <li key={`${index}-${item.href}`}>
              {/* A part of this page stays a plain anchor; a page gets the locale. */}
              {item.href.startsWith("#") ? (
                <a href={item.href} {...props}>
                  {content}
                </a>
              ) : (
                <Link href={item.href} {...props}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
