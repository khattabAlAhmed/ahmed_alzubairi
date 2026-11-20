import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { withParam, type ListingQuery } from "./links";

/*
 * The FilterChips board: square chips with a hairline frame and a square
 * check. The chosen chip takes the accent wash and a filled check, so it never
 * relies on color alone. Square, not pills.
 */
const CHIP = cx(
  "group inline-flex min-h-10 max-w-full items-center gap-2 border px-3.5 py-1.5 text-start text-sm transition-state focus-ring",
  "border-line-strong bg-bg text-ink hover:bg-surface-hover",
  "aria-[current=true]:border-accent aria-[current=true]:bg-accent-wash",
);

export type FilterChip = {
  value: string;
  label: string;
  /** How many items this filter shows. Passed formatted, in the page's digits. */
  count?: string;
};

/**
 * One row of filter links that set `param`. "All" comes first and clears it.
 * Each chip is a plain link (filters work without JavaScript), keeps the
 * page's other params, and goes back to page 1. The row wraps at every width,
 * with its name at the start.
 */
export function FilterChips({
  label,
  pathname,
  param,
  options,
  query = {},
  allLabel,
  className,
}: {
  /** Names the group for screen readers and shows above the chips. */
  label: string;
  pathname: string;
  param: string;
  options: FilterChip[];
  query?: ListingQuery;
  /** Overrides "All". */
  allLabel?: string;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const active = query[param] ?? null;
  const chips = [{ value: null, label: allLabel ?? t("filterAll") }, ...options];

  return (
    <nav aria-label={label} className={cx("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <p aria-hidden="true" className="min-w-22 text-[13px] leading-[1.7] text-ink-2">
        {label}
      </p>
      <ul className="flex min-w-0 flex-wrap gap-2">
        {chips.map((chip) => {
          const on = chip.value === active || (chip.value === null && !options.some((o) => o.value === active));
          const count = "count" in chip ? chip.count : undefined;
          return (
            <li key={chip.value ?? ""} className="max-w-full">
              <Link
                href={{ pathname, query: withParam(query, param, chip.value, ["page"]) }}
                aria-current={on ? "true" : undefined}
                scroll={false}
                className={CHIP}
              >
                <span
                  aria-hidden="true"
                  className="grid size-3.5 shrink-0 place-content-center border-[1.5px] border-line-strong group-aria-[current=true]:border-accent group-aria-[current=true]:bg-accent"
                >
                  {on && <CheckIcon strokeWidth={2.5} className="size-2.5 text-on-accent" />}
                </span>
                {chip.label}
                {count && <span className="text-xs text-ink-2 tabular-nums">{count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
