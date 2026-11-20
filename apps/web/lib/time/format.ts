import { dateLocale, intlLocale } from "@/components/public/home/format";
import { zoneName } from "@/components/workspace/format";

/*
 * Dates and times everywhere outside the public pages (DESIGN.md "Numbers",
 * the Numbers board): Arabic-Indic digits in Arabic, "14 March 2025" in
 * English, a 12-hour clock ("2:30 pm" / "٢:٣٠ م"), and the zone named as a
 * Latin code that keeps Western digits ("GMT+3"). Values are stored in UTC;
 * `timeZone` only chooses where they're shown, and undefined means the
 * browser's zone.
 */

export { dateLocale, intlLocale, zoneName };

/** `short`: 14 Mar 2025 · `long`: 14 March 2025 · `full`: Friday, 14 March 2025. */
export type DateLength = "short" | "long" | "full";

export type DateTimeOptions = {
  /** The date's length, or false for the time alone. */
  date?: DateLength | false;
  /** Show the time of day. */
  time?: boolean;
  /** Name the zone after the time, as "(GMT+3)". On by default when the time shows. */
  zone?: boolean;
  /** An IANA zone. Undefined: the runtime's zone (the viewer's, in a browser). */
  timeZone?: string;
};

const DATE_PARTS: Record<DateLength, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  full: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
};

// Named parts, not `timeStyle`: en-GB's time style pads the hour ("02:30 pm").
const TIME_PARTS: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

/** The Intl options for a date and/or time, without the zone name. */
export function dateTimeParts({ date = "short", time = true, timeZone }: DateTimeOptions): Intl.DateTimeFormatOptions {
  return { ...(date ? DATE_PARTS[date] : {}), ...(time ? TIME_PARTS : {}), timeZone };
}

/** " (GMT+3)", or "" when the zone isn't named. */
function zoneSuffix(value: Date, locale: string, options: DateTimeOptions): string {
  const named = options.zone ?? options.time ?? true;
  return named ? ` (${zoneName(value, locale, "short", options.timeZone)})` : "";
}

/**
 * "14 Mar 2025, 2:30 pm (GMT+3)" / "١٤ مارس ٢٠٢٥، ٢:٣٠ م (GMT+3)". With
 * `time: false` the date alone, and the zone isn't named.
 */
export function formatDateTime(value: Date | string, locale: string, options: DateTimeOptions = {}): string {
  const at = toDate(value);
  const text = new Intl.DateTimeFormat(dateLocale(locale), dateTimeParts(options)).format(at);
  return text + zoneSuffix(at, locale, options);
}

/** A start-to-end time on one day: "2:30–3:30 pm" / "٢:٣٠–٣:٣٠ م". The zone isn't named here. */
export function formatTimeRange(start: Date, end: Date, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { ...TIME_PARTS, timeZone }).formatRange(start, end);
}

/** A count, amount or percent in the page's digits: "١٬٢٠٠" / "1,200". */
export function formatCount(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/** A month and year, for chart axes and month pickers: "Mar 2025" / "مارس ٢٠٢٥". */
export function formatMonth(
  value: Date,
  locale: string,
  options: { month?: "short" | "long"; year?: boolean; timeZone?: string } = {},
): string {
  const { month = "short", year = true, timeZone } = options;
  return new Intl.DateTimeFormat(dateLocale(locale), {
    month,
    ...(year ? { year: "numeric" } : {}),
    timeZone,
  }).format(value);
}

/**
 * An IANA zone as a picker or note shows it: "Asia/Riyadh (GMT+3)", with the
 * offset on `at` (daylight saving moves it). Both parts are codes, Latin with
 * Western digits in every language. The offset, not a short name, since some
 * zones' short names are letters ("EST"). An unknown zone shows as written.
 */
export function zoneLabel(zone: string, at: Date = new Date()): string {
  try {
    const offset = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${zone} (${offset})` : zone;
  } catch {
    return zone;
  }
}
