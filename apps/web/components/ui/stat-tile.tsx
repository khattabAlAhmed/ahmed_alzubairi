import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx, FOCUS_RING } from "./cx";
import { Skeleton } from "./skeleton";

/**
 * `better` and `worse` say whether the change is good news, not which way the
 * number moved: fewer days to first reply is `better` with a down arrow.
 */
export type StatChangeTone = "better" | "worse" | "neutral";

export type StatChange = {
  /** Which way the number moved. Drives the arrow only. */
  direction: "up" | "down" | "flat";
  tone: StatChangeTone;
  /** The formatted change, e.g. "+12%". The caller formats it with Intl. */
  value: string;
  /** The period it compares with, e.g. "vs last month". Read with the value, so the color is never the only cue. */
  label: string;
};

export type StatTileState = "ready" | "loading" | "unavailable";

// A good change reads in ink, a bad one in danger, a neutral one in ink-2;
// the arrow and the words carry the meaning, never the color alone.
const CHANGE_TONES: Record<StatChangeTone, string> = {
  better: "text-ink",
  worse: "text-danger",
  neutral: "text-ink-2",
};

function ChangeArrow({ direction }: { direction: StatChange["direction"] }) {
  // Up and down don't mirror in Arabic; flat is a dash, not an arrow.
  const path = direction === "up" ? "M12 19V5M6 11l6-6 6 6" : direction === "down" ? "M12 5v14M6 13l6 6 6-6" : "M5 12h14";
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * One KPI: a label, a big value, and optionally its unit, a hint and the
 * change since the previous period. The caller formats every number with
 * `Intl` in the user's locale.
 *
 * `loading` shows a skeleton. `unavailable` is for a KPI whose source failed:
 * the tile keeps its label and says so, instead of showing a wrong zero.
 *
 * With `href` the whole tile is one link, named by its label and value, for
 * a number that leads to its list (the dashboard summary). Only a ready tile
 * is a link: a loading or unavailable one has no number to name it. A linked
 * tile's hint is plain text, so no link ends up inside the tile's link.
 */
type StatTileLink =
  | {
      /** Makes the whole (ready) tile a link to this page. */
      href: string;
      /** Plain text only: the tile is already a link. */
      hint?: string;
    }
  | {
      href?: undefined;
      /** A short line under the value, e.g. what the KPI counts. */
      hint?: ReactNode;
    };

export function StatTile({
  label,
  value,
  unit,
  hint,
  change,
  state = "ready",
  loadingLabel,
  unavailableLabel,
  href,
  need = false,
  className,
}: StatTileLink & {
  /** Something waits on the team: the number takes the accent (the StatTile board's "needs action first"). */
  need?: boolean;
  label: string;
  /** The formatted value, e.g. "1,284". Required when `state` is `ready`. */
  value?: string;
  /** Shown after the value in smaller text, e.g. "days". */
  unit?: string;
  change?: StatChange;
  state?: StatTileState;
  /** Read by screen readers while loading. Required with `loading`. */
  loadingLabel?: string;
  /** Shown in place of the value, e.g. "Not available right now". Required with `unavailable`. */
  unavailableLabel?: string;
  className?: string;
}) {
  // The StatTile board: no card. Each tile opens with the heavy rule (a row
  // of tiles reads as one ledger), its label, the number large, a hint, and
  // a hairline under it. Full height, so tiles in one grid row line up.
  const classes = cx("flex h-full min-w-0 flex-col gap-1 border-t-2 border-b border-rule border-b-line py-4 text-ink", className);
  const content = (
    <>
      {label ? (
        <p className="text-pretty text-ink-2 type-caption">{label}</p>
      ) : (
        // A skeleton tile with no label yet keeps the label's line.
        state === "loading" && <Skeleton className="h-4 w-40" />
      )}

      {state === "loading" && (
        <>
          {loadingLabel && (
            <span className="sr-only" role="status">
              {loadingLabel}
            </span>
          )}
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-36" />
        </>
      )}

      {state === "unavailable" && (
        <p className="flex items-center gap-2 text-base text-ink-2">
          {/* A dash where the number would be, so the tile keeps its shape. */}
          <span aria-hidden="true" className="text-[36px] leading-[1.15] font-medium">
            —
          </span>
          <span>{unavailableLabel}</span>
        </p>
      )}

      {state === "ready" && (
        <>
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cx("text-[36px] leading-[1.15] font-medium tabular-nums break-words", need && "text-accent")}>
              {value}
            </span>
            {unit && <span className="text-base text-ink-2">{unit}</span>}
          </p>
          {change && (
            <p className={cx("flex flex-wrap items-center gap-x-1.5 text-sm", CHANGE_TONES[change.tone])}>
              <ChangeArrow direction={change.direction} />
              {/* The value keeps its own direction, so "+12%" isn't reordered in Arabic. */}
              <bdi className="font-medium">{change.value}</bdi>
              <span className="text-ink-2">{change.label}</span>
            </p>
          )}
          {hint && <p className="text-[13px] leading-[1.7] text-pretty text-ink-2">{hint}</p>}
        </>
      )}
    </>
  );

  if (href && state === "ready") {
    return (
      <Link
        href={href}
        className={cx(classes, "transition-state hover:bg-surface-hover", FOCUS_RING)}
      >
        {content}
      </Link>
    );
  }
  return (
    <div className={classes} aria-busy={state === "loading" || undefined}>
      {content}
    </div>
  );
}
