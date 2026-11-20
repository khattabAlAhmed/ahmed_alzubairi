"use client";

import { useInBrowser } from "@/components/workspace/use-in-browser";
import { formatDateTime, type DateTimeOptions } from "./format";

export type LocalTimeProps = DateTimeOptions & {
  /** UTC, ISO 8601. */
  value: string;
  /** The page language. */
  locale: string;
  /** What the server sends, before the browser knows the viewer's zone. Empty by default. */
  fallback?: string;
};

/**
 * A stored UTC moment in the viewer's language and time zone, the zone named
 * when the time shows (§6.17, DESIGN.md "Numbers"). Without a fixed
 * `timeZone` the server doesn't know the zone, so it sends `fallback` and the
 * browser fills the text in.
 */
export function LocalTime({ value, locale, fallback = "", ...options }: LocalTimeProps) {
  const inBrowser = useInBrowser();
  const show = inBrowser || options.timeZone !== undefined;
  return <time dateTime={value}>{show ? formatDateTime(value, locale, options) : fallback}</time>;
}
