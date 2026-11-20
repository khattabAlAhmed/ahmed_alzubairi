"use client";

import { useLocale } from "next-intl";
import { LocalTime } from "@/lib/time/local-time";

/**
 * A moment in the viewer's language and time zone (§6.7): by default the
 * weekday, date and time with the zone named, or with `dateOnly` just the
 * date. The server doesn't know the zone, so it sends `fallback` (the date in
 * UTC) and the browser replaces it with the local value.
 */
export function LocalDateTime({
  value,
  fallback,
  dateOnly = false,
}: {
  value: string;
  fallback: string;
  dateOnly?: boolean;
}) {
  const locale = useLocale();
  return dateOnly ? (
    <LocalTime value={value} locale={locale} fallback={fallback} date="long" time={false} />
  ) : (
    <LocalTime value={value} locale={locale} fallback={fallback} date="full" />
  );
}
