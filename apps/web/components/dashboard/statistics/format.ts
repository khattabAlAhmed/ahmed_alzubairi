import type { StatChange } from "@/components/ui";
import { intlLocale } from "@/lib/time/format";

/** The latest month and the one before, from a monthly series. */
export function lastTwo(values: readonly number[]): { current: number; previous: number } {
  return { current: values.at(-1) ?? 0, previous: values.at(-2) ?? 0 };
}

/**
 * The change since last month, as a signed whole number ("+3", "−2"). More is
 * better for every count on the page. The label is the caller's text.
 */
export function monthChange(values: readonly number[], locale: string, label: string): StatChange | undefined {
  if (values.length < 2) return undefined;
  const { current, previous } = lastTwo(values);
  const difference = current - previous;
  const format = new Intl.NumberFormat(intlLocale(locale), { signDisplay: "exceptZero", maximumFractionDigits: 1 });
  return {
    direction: difference > 0 ? "up" : difference < 0 ? "down" : "flat",
    tone: difference > 0 ? "better" : difference < 0 ? "worse" : "neutral",
    value: format.format(difference),
    label,
  };
}

/** Sign-ups as a share of visitors, in percent; null with no measured visitors (not 0%). */
export function sharePercent(signups: number, visitors: number): number | null {
  if (!(visitors > 0)) return null;
  return Math.round((signups / visitors) * 1000) / 10;
}

/** A whole series of zeros has nothing to plot: the chart shows its empty state. */
export function plotted<T extends { value: number }>(points: T[]): T[] {
  return points.some((point) => point.value !== 0) ? points : [];
}
