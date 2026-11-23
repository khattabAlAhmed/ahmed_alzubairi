import { useTranslations } from "next-intl";
import { TAB_LIST, tabClasses } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { withParam, type ListingQuery } from "../listing";

export type CategoryTab = {
  value: string;
  label: string;
  /** How many items the tab shows, formatted in the page's digits. */
  count: string;
};

/**
 * Category tabs over a list (the Blog and Media mockups), in the Documents
 * tabs' look. The filter lives in the URL and the server filters, so each tab
 * is a plain link: it works without JavaScript and a shared link opens the
 * same tab. The chosen tab has `aria-current="page"`. "All" comes first and
 * clears `param`; every tab keeps the page's other params and goes back to
 * page 1.
 */
export function CategoryTabs({
  label,
  pathname,
  param,
  options,
  allCount,
  query = {},
  className,
}: {
  /** Names the tabs for screen readers. */
  label: string;
  pathname: string;
  param: string;
  options: CategoryTab[];
  /** How many items "All" shows, formatted. */
  allCount: string;
  query?: ListingQuery;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const active = query[param] ?? null;
  const known = options.some((option) => option.value === active);
  const tabs = [{ value: null, label: t("filterAll"), count: allCount }, ...options];

  return (
    <nav aria-label={label} className={className}>
      <ul className={cx(TAB_LIST, "m-0 list-none p-0")}>
        {tabs.map((tab) => {
          const on = tab.value === null ? !known : tab.value === active;
          return (
            <li key={tab.value ?? ""} className="flex shrink-0">
              <Link
                href={{ pathname, query: withParam(query, param, tab.value, ["page"]) }}
                aria-current={on ? "page" : undefined}
                scroll={false}
                className={tabClasses(on)}
              >
                {tab.label}{" "}
                {/* A count of its own, not "· ١": a middle dot beside Arabic digits reads as a zero. */}
                <span className="text-ink-2 tabular-nums">{tab.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
