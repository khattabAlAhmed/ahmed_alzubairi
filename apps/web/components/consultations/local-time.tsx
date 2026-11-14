"use client";

import { useLocale } from "next-intl";
import { useInBrowser } from "@/components/workspace/use-in-browser";

/**
 * A UTC time in the viewer's locale and browser zone, the zone named
 * (§6.17). The server doesn't know the zone, so it sends the element empty
 * and the browser fills it in.
 */
export function LocalTime({ value, withTime = true }: { value: string; withTime?: boolean }) {
  const locale = useLocale();
  const inBrowser = useInBrowser();
  return (
    <time dateTime={value}>
      {inBrowser &&
        new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          ...(withTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
        }).format(new Date(value))}
    </time>
  );
}
