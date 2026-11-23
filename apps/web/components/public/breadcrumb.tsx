import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { Link } from "@/i18n/navigation";

/** One step of the path. The last step is the page itself and takes no link. */
export type BreadcrumbItem = { label: string; href?: string };

/**
 * Where a page sits ("Services / Institutional governance"), as the Service
 * and Expertise mockups draw it: small `ink-2` text, the section as a link,
 * a slash between the steps, and the page itself last, as plain text (also
 * `ink-2`, as the mockups draw it) with `aria-current`. An ordered list in a labelled `nav` landmark. It follows the
 * page's direction: in Arabic the path reads from the right. The slash is the
 * same in both scripts and is hidden from screen readers, which announce the
 * list instead.
 */
export function Breadcrumb({ items, className }: { items: readonly BreadcrumbItem[]; className?: string }) {
  const t = useTranslations("Pages");
  if (items.length === 0) return null;

  return (
    <nav aria-label={t("breadcrumbLabel")} className={className}>
      <ol className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink-2">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              {index > 0 && (
                <li aria-hidden="true" className="list-none">
                  /
                </li>
              )}
              <li className="min-w-0">
                {last || !item.href ? (
                  <span aria-current={last ? "page" : undefined}>{item.label}</span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-ink-2 underline decoration-1 underline-offset-5 transition-state hover:text-ink hover:decoration-2 focus-ring"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
