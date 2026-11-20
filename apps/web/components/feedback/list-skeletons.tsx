import { Skeleton, SkeletonListItem, SkeletonRecord } from "@/components/ui/skeleton";
import { cx } from "@/components/ui/cx";

/**
 * Loading states per list type (the ListStates page): each takes the shape of
 * the list it stands for, so nothing jumps when the content arrives. Built
 * from T04's Skeleton, in `surface`, with a pulse that stops under "reduce
 * motion".
 *
 * - `projects`: records (rule, meta, title, label rows).
 * - `articles`: journal rows (date column, title line).
 * - `resources`: a file-type block and two lines.
 * - `courses`: a date block and two lines.
 * - `documents`: a glyph, a title and a status column.
 *
 * The region is `aria-busy` and says `label` ("Loading") to screen readers.
 */
export type ListSkeletonKind = "projects" | "articles" | "resources" | "courses" | "documents";

export function ListSkeleton({
  kind,
  label,
  rows = 3,
  className,
}: {
  kind: ListSkeletonKind;
  /** Read by screen readers while the list loads: "Loading". */
  label: string;
  rows?: number;
  className?: string;
}) {
  const items = Array.from({ length: rows }, (_, index) => index);
  return (
    <div aria-busy="true" className={cx(kind !== "projects" && "border-t-2 border-rule", className)}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {kind === "projects" && (
        <div className="flex flex-col gap-8">
          {items.slice(0, Math.min(rows, 2)).map((index) => (
            <SkeletonRecord key={index} />
          ))}
        </div>
      )}
      {kind === "articles" && items.map((index) => <SkeletonListItem key={index} />)}
      {kind === "resources" &&
        items.map((index) => (
          <div key={index} aria-hidden="true" className="grid grid-cols-[44px_1fr] gap-4 border-b border-line py-4">
            <Skeleton className="h-14" />
            <span className="flex flex-col gap-2">
              <Skeleton className={cx("h-3", index % 2 ? "w-[70%]" : "w-4/5")} />
              <Skeleton className={cx("h-3", index % 2 ? "w-2/5" : "w-1/2")} />
            </span>
          </div>
        ))}
      {kind === "courses" &&
        items.map((index) => (
          <div key={index} aria-hidden="true" className="grid grid-cols-[72px_1fr] gap-4 border-b border-line py-4">
            <Skeleton className="h-16" />
            <span className="flex flex-col gap-2">
              <Skeleton className="h-3 w-[70%]" />
              <Skeleton className="h-3 w-2/5" />
            </span>
          </div>
        ))}
      {kind === "documents" &&
        items.map((index) => (
          <div key={index} aria-hidden="true" className="grid grid-cols-[24px_1fr_80px] gap-4 border-b border-line py-4">
            <Skeleton className="h-5" />
            <Skeleton className={cx("h-3", index % 2 ? "w-3/5" : "w-4/5")} />
            <Skeleton className="h-3" />
          </div>
        ))}
    </div>
  );
}
