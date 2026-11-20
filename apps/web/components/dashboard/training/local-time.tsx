"use client";

import { useLocale } from "next-intl";
import { LocalTime as SharedLocalTime } from "@/lib/time/local-time";

/** A date and time in the viewer's locale and time zone, the zone named. */
export function LocalTime({ value }: { value: string }) {
  return <SharedLocalTime value={value} locale={useLocale()} />;
}
