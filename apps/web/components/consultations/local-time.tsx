"use client";

import { useLocale } from "next-intl";
import { LocalTime as SharedLocalTime } from "@/lib/time/local-time";

/** A UTC time in the viewer's locale and browser zone, the zone named (§6.17). */
export function LocalTime({ value, withTime = true }: { value: string; withTime?: boolean }) {
  return <SharedLocalTime value={value} locale={useLocale()} time={withTime} />;
}
