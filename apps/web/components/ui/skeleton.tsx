import { cx } from "./cx";

/**
 * A placeholder block while content loads. Hidden from screen readers: put
 * `aria-busy` and a visually hidden status message on the loading region.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "animate-pulse rounded-md bg-text/10 motion-reduce:animate-none",
        className ?? "h-4 w-full",
      )}
    />
  );
}

/** Lines of text. The last line is shorter, like a real paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cx("h-4", index === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
