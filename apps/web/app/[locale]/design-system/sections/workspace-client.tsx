"use client";

import { useState, type ReactNode } from "react";
import { DataTable, type DataTableColumn, type DataTableSort } from "@/components/workspace/data-table";
import { Composer } from "@/components/workspace/composer";
import { formatCount } from "@/lib/time/format";
import type { FileChipData } from "@/components/workspace/file-chip";

/*
 * Demo-only client parts for the workspace section of the design-system page:
 * composer and table state. No API calls; nothing in the app imports this.
 */

const noop = () => {};

/** A composer frozen in one of its states. */
export function DemoComposer({
  value = "",
  files = [],
  sending = false,
  error,
}: {
  value?: string;
  files?: FileChipData[];
  sending?: boolean;
  error?: string;
}) {
  const [text, setText] = useState(value);
  return (
    <Composer
      value={text}
      onChange={setText}
      files={files}
      onAttach={noop}
      onRemoveFile={noop}
      onSend={noop}
      sending={sending}
      error={error}
    />
  );
}

/** The table with working sort and selection, on fixed rows. */
export function DemoDataTable({
  caption,
  columns,
  rows,
  labels,
  toolbar,
  bulk,
  locale,
}: {
  caption: string;
  columns: DataTableColumn[];
  rows: { id: string; cells: Record<string, ReactNode>; sortValues: Record<string, string | number>; action?: ReactNode }[];
  labels: { selectAll: string; selectRow: string; actions: string; selected: string };
  /** Filters on the start side of the bar above the table. */
  toolbar: ReactNode;
  /** The bulk actions after the selected count, such as "Assign · Change status". */
  bulk: ReactNode;
  locale: string;
}) {
  const [sort, setSort] = useState<DataTableSort>({ key: "activity", direction: "descending" });
  const [selected, setSelected] = useState<Set<string>>(() => new Set([rows[0]?.id ?? ""]));
  const sorted = [...rows].sort((a, b) => {
    const x = a.sortValues[sort.key];
    const y = b.sortValues[sort.key];
    const order = x < y ? -1 : x > y ? 1 : 0;
    return sort.direction === "ascending" ? order : -order;
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {toolbar}
        <p className="text-[13px] leading-[1.7] text-ink-2">
          {labels.selected.replace("{count}", formatCount(selected.size, locale))} · {bulk}
        </p>
      </div>
      <DataTable
        caption={caption}
        columns={columns}
        rows={sorted}
        sort={sort}
        onSort={(key) =>
          setSort((current) => ({
            key,
            direction: current.key === key && current.direction === "descending" ? "ascending" : "descending",
          }))
        }
        selected={selected}
        onSelect={(ids, checked) =>
          setSelected((current) => {
            const next = new Set(current);
            for (const id of ids) {
              if (checked) next.add(id);
              else next.delete(id);
            }
            return next;
          })
        }
        labels={{
          selectAll: labels.selectAll,
          selectRow: (name) => labels.selectRow.replace("{name}", name),
          actions: labels.actions,
        }}
      />
    </div>
  );
}
