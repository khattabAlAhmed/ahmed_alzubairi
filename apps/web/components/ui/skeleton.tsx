import { cx } from "./cx";

/*
 * The Skeleton board: placeholders in `surface`, shaped like what will appear,
 * with a slow breath (Tailwind's 2s `pulse`) that stops under "reduce motion". Hidden from
 * screen readers: put `aria-busy` and a visually hidden status message on the
 * loading region.
 */
const BREATHE = "bg-surface motion-safe:animate-pulse";

/** A placeholder block. Size it with `className`; a 12px line by default. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx(BREATHE, className ?? "h-3 w-full")} />;
}

/** Lines of text. The last line is shorter, like a real paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cx("h-3", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** An image at its crop, with a caption line and a title under it. */
export function SkeletonImage({ aspect = "aspect-[3/2]", className }: { aspect?: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("flex flex-col gap-2.5", className)}>
      <Skeleton className={cx("w-full", aspect)} />
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-4.5 w-3/4" />
    </div>
  );
}

/** A row of a list: a short label column and a line of text, over a hairline. */
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx("grid grid-cols-[72px_1fr] gap-4 border-b border-line py-4", className)}>
      <Skeleton className="h-3" />
      <Skeleton className="h-3 w-[85%]" />
    </div>
  );
}

/** A record: its opening rule, the meta line, the title and two label rows. */
export function SkeletonRecord({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx("border-t-2 border-rule", className)}>
      <div className="flex justify-between gap-4 border-b border-line py-2.5">
        <Skeleton className="h-3 w-[30%]" />
        <Skeleton className="h-3 w-[20%]" />
      </div>
      <div className="py-4.5">
        <Skeleton className="h-5 w-4/5" />
      </div>
      {["w-full", "w-[85%]"].map((width) => (
        <div key={width} className="grid grid-cols-[var(--label-col)_1fr] gap-6 border-b border-line py-3.5">
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className={cx("h-3", width)} />
        </div>
      ))}
    </div>
  );
}
