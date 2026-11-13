"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * A UTC time in the viewer's locale and time zone. The server doesn't know
 * the zone, so the browser fills the text in.
 */
export function LocalTime({
  value,
  locale,
  withTime = true,
}: {
  value: string;
  locale: string;
  withTime?: boolean;
}) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <time dateTime={value}>
      {inBrowser &&
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: withTime ? "short" : undefined,
        }).format(new Date(value))}
    </time>
  );
}
