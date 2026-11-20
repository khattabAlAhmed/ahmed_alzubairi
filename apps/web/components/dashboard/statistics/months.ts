import { isIanaTimeZone } from "@repo/shared";
import { formatMonth } from "@/lib/time/format";

/** How many months the page shows, the current one last. */
export const MONTHS = 12;

/** One calendar month in the viewer's time zone, as a half-open UTC range. */
export type MonthWindow = {
  /** `YYYY-MM` in the viewer's time zone. */
  key: string;
  start: Date;
  end: Date;
};

/**
 * The viewer's zone in its canonical spelling (Intl accepts "asia/riyadh",
 * PostHog's HogQL doesn't), or UTC when it is unset or not a real IANA name.
 */
export function viewerTimeZone(value: string | null | undefined): string {
  if (!value || !isIanaTimeZone(value)) return "UTC";
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function parts(instant: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
  return values;
}

/** The zone's offset from UTC at this instant, in milliseconds. */
function offset(instant: Date, timeZone: string): number {
  const p = parts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant of local midnight on the 1st of this month in the zone. */
export function monthStart(year: number, month: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, 1);
  // Two passes settle a DST change between the guess and the answer.
  let guess = wall - offset(new Date(wall), timeZone);
  guess = wall - offset(new Date(guess), timeZone);
  return new Date(guess);
}

/** `YYYY-MM` of this instant in the zone. */
export function monthKey(instant: Date, timeZone: string): string {
  const p = parts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** The last `count` months in the zone, oldest first, ending with the current one. */
export function monthWindows(now: Date, timeZone: string, count = MONTHS): MonthWindow[] {
  const p = parts(now, timeZone);
  const windows: MonthWindow[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const index = p.year * 12 + (p.month - 1) - back;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const next = index + 1;
    windows.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      start: monthStart(year, month, timeZone),
      end: monthStart(Math.floor(next / 12), (next % 12) + 1, timeZone),
    });
  }
  return windows;
}

/** Counts per window from instants, by the month they fall in. Outside instants are left out. */
export function bucket(instants: readonly Date[], windows: readonly MonthWindow[]): number[] {
  const counts = windows.map(() => 0);
  for (const instant of instants) {
    const index = windows.findIndex((window) => instant >= window.start && instant < window.end);
    if (index !== -1) counts[index]! += 1;
  }
  return counts;
}

/** A short month label in the viewer's language, e.g. "Nov" or "نوفمبر". */
export function monthLabel(key: string, locale: string, withYear = false): string {
  const [year, month] = key.split("-").map(Number) as [number, number];
  return formatMonth(new Date(Date.UTC(year, month - 1, 15)), locale, { year: withYear, timeZone: "UTC" });
}
