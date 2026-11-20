import type { Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { ArrowForwardIcon } from "@/components/icons";
import { formatNumber } from "@/components/public/home/format";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { pageItems, withParam, type ListingQuery } from "./links";

/*
 * The Pagination board: previous and next as quiet text with an arrow that
 * mirrors with the language, the numbers between them in ink-2, and the
 * current page in ink with the 2px accent underline. A hairline above.
 */
const STEP = "inline-flex min-h-11 items-center gap-2 px-0.5 text-[15px] transition-state focus-ring";
const NUMBER =
  "inline-grid h-11 min-w-11 place-content-center text-[15px] tabular-nums transition-state focus-ring";

/**
 * Previous, page numbers and next, as links that set `page` and keep the
 * page's other params. Page 1 has no `page` param. On phones only previous,
 * "page 2 of 9" and next show; the numbers join from `sm` up. Hidden when
 * there's one page. Numbers use the page's digits (Arabic-Indic in Arabic).
 */
export function Pagination({
  pathname,
  page,
  totalPages,
  query = {},
  className,
}: {
  pathname: string;
  page: number;
  totalPages: number;
  query?: ListingQuery;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const locale = useLocale() as Locale;
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const href = (p: number) => ({
    pathname,
    query: withParam(query, "page", p > 1 ? String(p) : null),
  });
  const n = (value: number) => formatNumber(value, locale);

  return (
    <nav
      aria-label={t("paginationLabel")}
      className={cx("flex items-center justify-between gap-2 border-t border-line pt-2", className)}
    >
      {current > 1 ? (
        <Link href={href(current - 1)} rel="prev" className={cx(STEP, "text-accent hover:text-ink")}>
          <ArrowForwardIcon className="size-4 rotate-180" />
          {t("previous")}
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(STEP, "text-ink-2")}>
          <ArrowForwardIcon className="size-4 rotate-180" />
          {t("previous")}
        </span>
      )}

      <p className="text-[13px] text-ink-2 sm:hidden">{t("pageOf", { page: n(current), total: n(totalPages) })}</p>

      <ul className="hidden items-center gap-1 sm:flex">
        {pageItems(current, totalPages).map((item) =>
          item.kind === "gap" ? (
            <li key={item.key} aria-hidden="true" className="inline-grid h-11 min-w-11 place-content-center text-ink-2">
              …
            </li>
          ) : (
            <li key={item.page}>
              <Link
                href={href(item.page)}
                aria-current={item.page === current ? "page" : undefined}
                aria-label={t("page", { page: n(item.page) })}
                className={cx(
                  NUMBER,
                  item.page === current ? "text-ink shadow-[inset_0_-2px_0_var(--accent)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {n(item.page)}
              </Link>
            </li>
          ),
        )}
      </ul>

      {current < totalPages ? (
        <Link href={href(current + 1)} rel="next" className={cx(STEP, "text-accent hover:text-ink")}>
          {t("next")}
          <ArrowForwardIcon className="size-4" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(STEP, "text-ink-2")}>
          {t("next")}
          <ArrowForwardIcon className="size-4" />
        </span>
      )}
    </nav>
  );
}
