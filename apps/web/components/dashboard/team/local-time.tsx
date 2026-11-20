"use client";

import { LocalTime as SharedLocalTime } from "@/lib/time/local-time";

/** A UTC time in the viewer's locale and time zone, the zone named. */
export function LocalTime({ value, locale, withTime = true }: { value: string; locale: string; withTime?: boolean }) {
  return <SharedLocalTime value={value} locale={locale} time={withTime} />;
}
