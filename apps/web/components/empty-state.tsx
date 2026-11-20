import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * The EmptyState board: an empty list as an empty record. A dashed outline of
 * a record row (its label column and its value) instead of an illustration,
 * under the heavy opening rule; then why it's empty and the next step, in his
 * voice. On the home page an empty section isn't shown at all.
 *
 * `outline={false}` drops the dashed record, for a list's empty state that
 * sits where the list's first row would be (the ListStates page).
 *
 * `level` keeps the outline right: 1 when the empty state is the whole page
 * (as on the account and editor pages), 2 or 3 inside a page.
 */
export function EmptyState({
  title,
  text,
  action,
  level = 1,
  outline = true,
  className,
}: {
  title: string;
  /** Why it's empty. */
  text: string;
  /** The next step: a MoreLink, or a small secondary or primary button. */
  action?: ReactNode;
  level?: 1 | 2 | 3;
  outline?: boolean;
  className?: string;
}) {
  const Heading = `h${level}` as const;
  return (
    <section className={cx("flex flex-col gap-2.5 border-t-2 border-rule py-5.5", className)}>
      {outline && (
        <div aria-hidden="true" className="grid h-16 grid-cols-[var(--label-col)_1fr] border border-dashed border-line-strong">
          <span className="border-e border-dashed border-line-strong" />
          <span />
        </div>
      )}
      <Heading className={cx(outline && "mt-1", "type-h3")}>{title}</Heading>
      <p className="max-w-measure text-pretty text-ink-2 type-small">{text}</p>
      {action && <div className="mt-1 flex flex-wrap items-center gap-3">{action}</div>}
    </section>
  );
}
