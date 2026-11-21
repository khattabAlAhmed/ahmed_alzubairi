"use client";

import { useLocale } from "next-intl";
import { dateLocale } from "@/lib/time/format";
import { useInBrowser } from "@/components/workspace/use-in-browser";

/** Day and month of a stored UTC moment, in the given zone (undefined: the runtime's). */
export function dayAndMonth(value: string, locale: string, timeZone?: string): { day: string; month: string } {
  const at = new Date(value);
  const intl = dateLocale(locale);
  return {
    day: new Intl.DateTimeFormat(intl, { day: "numeric", timeZone }).format(at),
    month: new Intl.DateTimeFormat(intl, { month: "long", timeZone }).format(at),
  };
}

/**
 * The schedule's date block (CourseItem board): the day large, the month
 * under it, in the viewer's zone. The server doesn't know the zone, so it
 * shows UTC until the browser takes over. Decorative: the row says the full
 * date in words beside it.
 */
export function DateBlock({ value }: { value: string }) {
  const locale = useLocale();
  const inBrowser = useInBrowser();
  const { day, month } = dayAndMonth(value, locale, inBrowser ? undefined : "UTC");
  return (
    <span aria-hidden="true" className="flex w-[88px] flex-col items-center border border-line-strong py-2">
      <b className="text-[28px] leading-[1.1] font-medium tabular-nums">{day}</b>
      <span className="text-xs text-ink-2">{month}</span>
    </span>
  );
}
