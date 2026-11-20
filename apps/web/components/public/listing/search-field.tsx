import { useLocale, useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";
import { getPathname, Link } from "@/i18n/navigation";
import { SearchIcon } from "./icons";
import type { ListingQuery } from "./links";

/**
 * The SearchField board: one bar with a hairline frame and a 2px ink
 * underline, the search icon at the start, and the live result line under it.
 *
 * A GET form that submits `q` to `pathname`, so search works without
 * JavaScript and the URL can be shared: Enter submits it. `query` holds the
 * page's other params (a category, say): they ride along as hidden fields.
 * `page` never does, so a new search starts on page 1.
 */
export function SearchField({
  pathname,
  value = "",
  query = {},
  label,
  clearLabel,
  status,
  className,
}: {
  /** The list page, without the locale: `/blog`. */
  pathname: string;
  /** The current search, shown in the field. */
  value?: string;
  query?: ListingQuery;
  /** Overrides the default "Search" label, e.g. "Search articles". */
  label?: string;
  /** With a search in the field, a clear button that goes back to the full list ("Clear the search"). */
  clearLabel?: string;
  /**
   * The line under the bar: how many results, or an honest no-results line
   * with a way on ("I haven't written about … yet"). Read out when it changes.
   */
  status?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();
  const id = useId();
  const action = getPathname({ href: pathname, locale });
  const kept = Object.entries(query).filter(
    (entry): entry is [string, string] => entry[0] !== "q" && entry[0] !== "page" && !!entry[1],
  );

  return (
    <div className={cx("flex w-full max-w-190 flex-col gap-1.5", className)}>
      <form
        role="search"
        method="get"
        action={action}
        className={cx(
          "flex min-h-13 items-center gap-2.5 border border-line-strong border-b-2 border-b-ink bg-bg ps-3.5",
          clearLabel && value ? "pe-0" : "pe-3.5",
          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus has-focus-visible:outline-solid",
        )}
      >
        <label htmlFor={id} className="sr-only">
          {label ?? t("searchLabel")}
        </label>
        <SearchIcon className="shrink-0 text-ink-2" />
        <input
          id={id}
          // Resets the field when the page's search changes: defaultValue alone only sets it once.
          key={value}
          type="search"
          name="q"
          defaultValue={value}
          placeholder={t("searchPlaceholder")}
          enterKeyHint="search"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[17px] text-ink outline-none placeholder:text-ink-2 [&::-webkit-search-cancel-button]:hidden"
        />
        {kept.map(([key, current]) => (
          <input key={key} type="hidden" name={key} value={current} />
        ))}
        {clearLabel && value && (
          <Link
            href={{ pathname, query: Object.fromEntries(kept) }}
            aria-label={clearLabel}
            className="inline-flex size-11 shrink-0 items-center justify-center text-ink transition-state hover:bg-surface-hover focus-ring"
          >
            <CloseIcon className="size-4" />
          </Link>
        )}
      </form>
      {status && (
        <p role="status" className="text-[13px] leading-[1.7] text-ink-2">
          {status}
        </p>
      )}
    </div>
  );
}
