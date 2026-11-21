"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { CheckIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";

export type DataTableColumn = {
  key: string;
  label: string;
  /** Shows a sort button in the header. */
  sortable?: boolean;
  /** The column that names the row: bold, and the first line of a stacked row on phones. */
  primary?: boolean;
  /** Numbers and dates line up with tabular figures. */
  numeric?: boolean;
};

export type DataTableRow = {
  id: string;
  cells: Record<string, ReactNode>;
  /** The row's own action, such as an "Open" link, at the end. */
  action?: ReactNode;
};

export type DataTableSort = { key: string; direction: "ascending" | "descending" };

/**
 * The DataTable board, for dashboard lists that compare rows: a header under
 * the heavy rule, hairlines between rows (no zebra stripes), row hover on
 * `surface-hover`, the selected rows on `accent-wash`, sortable headers, a
 * checkbox per row, and an action at the end. On phones each row becomes a
 * block: the primary column first, the others under it, the action last.
 *
 * Presentational: the caller owns the sort, the selection and what the bulk
 * actions do. Every label comes from the caller's messages.
 *
 * States (§13): with `loading`, the header stays and one quiet line under it
 * says the rows are on their way: no spinner, no shimmer. With `empty` and no
 * rows, the EmptyState record stands where the table would be, since column
 * headers over nothing tell the reader nothing. Without either prop the table
 * renders as it always has.
 */
export function DataTable({
  caption,
  columns,
  rows,
  sort,
  onSort,
  selected,
  onSelect,
  labels,
  loading,
  empty,
  className,
}: {
  /** Names the table for screen readers; visually hidden. */
  caption: string;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
  sort?: DataTableSort;
  onSort?: (key: string) => void;
  /** With it, each row gets a checkbox. */
  selected?: ReadonlySet<string>;
  onSelect?: (ids: string[], checked: boolean) => void;
  /** `selectAll`: the header checkbox; `selectRow(name)`: a row's checkbox; `actions`: the action column. */
  labels: { selectAll?: string; selectRow?: (name: string) => string; actions?: string };
  /** The rows are loading: the line to show, e.g. "Loading consultations…". Wins over `rows`. */
  loading?: string;
  /** Shown instead of the table when there are no rows: why, and the next step. */
  empty?: { title: string; text: string; action?: ReactNode; level?: 1 | 2 | 3 };
  className?: string;
}) {
  if (!loading && empty && rows.length === 0) {
    return <EmptyState title={empty.title} text={empty.text} action={empty.action} level={empty.level ?? 2} className={className} />;
  }
  const selectable = selected !== undefined && onSelect !== undefined;
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selected.has(row.id));
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const hasAction = rows.some((row) => row.action);
  // On phones the header shows only when it holds a control.
  const headerControls = selectable || (onSort !== undefined && columns.some((column) => column.sortable));

  // Square, with the check drawn on top in on-accent, like the Choice board's checkbox.
  const checkbox = (checked: boolean, label: string, onChange: (checked: boolean) => void) => (
    <span className="relative inline-block size-5 align-middle">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none border-[1.5px] border-line-strong bg-bg transition-state checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus focus-visible:outline-solid"
      />
      <CheckIcon
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute inset-0.5 hidden size-4 text-on-accent peer-checked:block"
      />
    </span>
  );

  return (
    <table aria-busy={loading ? true : undefined} className={cx("w-full border-collapse text-sm", className)}>
      <caption className="sr-only">{caption}</caption>
      {/* Phones: each row reads as a block, and the header keeps only its
          controls (select all, the sort buttons) as one line above the rows. */}
      <thead className={headerControls ? "max-md:block" : "max-md:sr-only"}>
        <tr className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-4 max-md:border-t-2 max-md:border-rule max-md:py-2">
          {selectable && (
            <th scope="col" className="w-10 border-t-2 border-b border-rule border-b-line px-3 py-2.5 text-start max-md:w-auto max-md:border-0 max-md:p-0">
              {checkbox(allSelected, labels.selectAll ?? "", (checked) => onSelect(rows.map((row) => row.id), checked))}
            </th>
          )}
          {columns.map((column) => {
            const sorted = sort?.key === column.key ? sort.direction : undefined;
            const control = column.sortable === true && onSort !== undefined;
            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={sorted ?? (column.sortable ? "none" : undefined)}
                className={cx(
                  "border-t-2 border-b border-rule border-b-line px-3 py-2.5 text-start text-[13px] font-medium whitespace-nowrap text-ink-2",
                  control ? "max-md:border-0 max-md:p-0" : "max-md:sr-only",
                )}
              >
                {control ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="inline-flex cursor-pointer items-center gap-1 text-inherit transition-state hover:text-ink focus-ring max-md:min-h-11"
                  >
                    {column.label}
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="square"
                      aria-hidden="true"
                      className={cx(!sorted && "opacity-0", sorted === "ascending" && "rotate-180")}
                    >
                      <path d="M12 5v14M6 13l6 6 6-6" />
                    </svg>
                  </button>
                ) : (
                  column.label
                )}
              </th>
            );
          })}
          {hasAction && (
            <th scope="col" className="border-t-2 border-b border-rule border-b-line px-3 py-2.5 max-md:sr-only">
              <span className="sr-only">{labels.actions}</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody className={cx("max-md:block", headerControls ? "max-md:border-t max-md:border-line" : "max-md:border-t-2 max-md:border-rule")}>
        {loading && (
          <tr className="border-b border-line max-md:block">
            <td colSpan={columns.length + (selectable ? 1 : 0) + (hasAction ? 1 : 0)} className="px-3 py-5 text-ink-2 max-md:block max-md:px-0">
              <span role="status" className="type-small">
                {loading}
              </span>
            </td>
          </tr>
        )}
        {!loading && rows.map((row) => {
          const isSelected = selectable && selected.has(row.id);
          const name = String(typeof row.cells[primary.key] === "string" ? row.cells[primary.key] : row.id);
          return (
            <tr
              key={row.id}
              aria-selected={selectable ? isSelected : undefined}
              className={cx(
                "border-b border-line transition-state hover:bg-surface-hover max-md:flex max-md:flex-col max-md:gap-1 max-md:py-3",
                isSelected && "bg-accent-wash hover:bg-accent-wash",
              )}
            >
              {selectable && (
                <td className="px-3 py-3 align-middle max-md:px-0 max-md:py-0">
                  {checkbox(isSelected, labels.selectRow?.(name) ?? name, (checked) => onSelect([row.id], checked))}
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    "px-3 py-3 align-middle max-md:px-0 max-md:py-0",
                    column.key === primary.key ? "font-medium" : "text-ink-2 max-md:text-[13px]",
                    column.numeric && "tabular-nums",
                  )}
                >
                  {row.cells[column.key]}
                </td>
              ))}
              {hasAction && (
                <td className="px-3 py-3 text-end align-middle whitespace-nowrap max-md:px-0 max-md:py-0 max-md:text-start">
                  {row.action}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
