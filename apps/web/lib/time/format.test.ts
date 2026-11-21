import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCount, formatDateTime, formatMonth, formatTimeRange, plainSpaces, zoneLabel } from "./format";

// 14 March 2025, 11:30 UTC: 2:30 pm in Riyadh.
const AT = new Date("2025-03-14T11:30:00Z");
const RIYADH = "Asia/Riyadh";

describe("formatDateTime (DESIGN.md Numbers)", () => {
  it("reads day month year in English, with a 12-hour clock and the zone named", () => {
    expect(formatDateTime(AT, "en", { timeZone: RIYADH })).toBe("14 Mar 2025, 2:30 pm (GMT+3)");
    expect(formatDateTime(AT, "en", { date: "long", time: false, timeZone: RIYADH })).toBe("14 March 2025");
    expect(formatDateTime(AT, "en", { date: "full", time: false, timeZone: RIYADH })).toBe("Friday, 14 March 2025");
  });

  it("uses Arabic-Indic digits in Arabic, and keeps the zone code Latin with Western digits", () => {
    expect(formatDateTime(AT, "ar", { timeZone: RIYADH })).toBe("١٤ مارس ٢٠٢٥، ٢:٣٠ م (GMT+3)");
    expect(formatDateTime(AT, "ar", { date: "long", time: false, timeZone: RIYADH })).toBe("١٤ مارس ٢٠٢٥");
  });

  it("names the zone only when the time shows, unless asked", () => {
    expect(formatDateTime(AT, "en", { time: false, timeZone: RIYADH })).not.toContain("GMT");
    expect(formatDateTime(AT, "en", { timeZone: RIYADH, zone: false })).toBe("14 Mar 2025, 2:30 pm");
  });

  it("only changes where the moment is shown, never the moment", () => {
    expect(formatDateTime("2025-03-14T22:30:00Z", "en", { time: false, timeZone: "UTC" })).toBe("14 Mar 2025");
    expect(formatDateTime("2025-03-14T22:30:00Z", "en", { time: false, timeZone: RIYADH })).toBe("15 Mar 2025");
  });
});

describe("other helpers", () => {
  it("formats a time range on one day", () => {
    const end = new Date(AT.getTime() + 3_600_000);
    expect(formatTimeRange(AT, end, "en", RIYADH)).toBe("2:30 – 3:30 pm");
    expect(formatTimeRange(AT, end, "ar", RIYADH)).toBe("٢:٣٠–٣:٣٠ م");
  });

  it("formats counts in the page's digits", () => {
    expect(formatCount(1200, "ar")).toBe("١٬٢٠٠");
    expect(formatCount(1200, "en")).toBe("1,200");
  });

  it("formats a month for chart axes", () => {
    expect(formatMonth(AT, "ar", { year: false, timeZone: "UTC" })).toBe("مارس");
    expect(formatMonth(AT, "en", { timeZone: "UTC" })).toBe("Mar 2025");
  });

  it("labels a zone with its offset, and leaves an unknown zone as written", () => {
    expect(zoneLabel(RIYADH, AT)).toBe("Asia/Riyadh (GMT+3)");
    expect(zoneLabel("Not/AZone", AT)).toBe("Not/AZone");
  });

  it("gives a zone the offset of the date it's for, across daylight saving", () => {
    expect(zoneLabel("America/New_York", new Date("2027-01-15T15:00:00Z"))).toBe("America/New_York (GMT-5)");
    expect(zoneLabel("America/New_York", new Date("2027-07-15T15:00:00Z"))).toBe("America/New_York (GMT-4)");
  });
});

// Node's ICU and the browser's differ in the spaces they emit; server and
// browser text must match for hydration (React #418).
describe("plain spaces (hydration)", () => {
  const THIN = "\u2009";
  const NARROW_NBSP = "\u202F";
  const SPECIAL = /[\u00A0\u2000-\u200A\u202F\u205F]/;
  const real = Intl.DateTimeFormat;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Intl as a runtime that writes `space` where it would write a plain one, plus thin spaces around a range's dash. */
  function stubIntl(space: string) {
    class Fake extends real {
      override format(value?: Date | number) {
        return super.format(value).replaceAll(" ", space);
      }
      override formatRange(a: Date | number, b: Date | number) {
        return super.formatRange(a, b).replace(/\s*–\s*/, `${THIN}–${THIN}`).replace(/ (am|pm|ص|م)$/, `${space}$1`);
      }
    }
    vi.stubGlobal("Intl", { ...Intl, DateTimeFormat: Fake });
  }

  const morning = new Date("2025-03-14T08:00:00Z"); // 11:00 am in Riyadh
  const noon = new Date("2025-03-14T09:00:00Z"); // 12:00 pm

  it("Node's real range output is plain after the fix", () => {
    expect(formatTimeRange(morning, noon, "en", RIYADH)).toBe("11:00 am – 12:00 pm");
    expect(formatTimeRange(morning, noon, "ar", RIYADH)).toBe("١١:٠٠ ص – ١٢:٠٠ م");
  });

  it.each([
    ["en", "11:00 am – 12:00 pm"],
    ["ar", "١١:٠٠ ص – ١٢:٠٠ م"],
  ])("a range with U+2009 around the dash and U+202F before am/pm comes out plain (%s)", (locale, expected) => {
    stubIntl(NARROW_NBSP);
    const range = new Intl.DateTimeFormat("en", { hour: "numeric", timeZone: RIYADH }).formatRange(morning, noon);
    expect(range).toMatch(/\u2009/); // the stub really emits them
    const text = formatTimeRange(morning, noon, locale, RIYADH);
    expect(text).toBe(expected);
    expect(text).not.toMatch(SPECIAL);
  });

  it.each([
    ["en", "14 Mar 2025, 2:30 pm (GMT+3)"],
    ["ar", "١٤ مارس ٢٠٢٥، ٢:٣٠ م (GMT+3)"],
  ])("a time with U+202F before am/pm comes out plain (%s)", (locale, expected) => {
    stubIntl(NARROW_NBSP);
    const text = formatDateTime(AT, locale, { timeZone: RIYADH });
    expect(text).toBe(expected);
    expect(text).not.toMatch(SPECIAL);
  });

  it("a month with special spaces comes out plain, keeping Arabic-Indic digits", () => {
    stubIntl(THIN);
    expect(formatMonth(AT, "en", { timeZone: RIYADH })).toBe("Mar 2025");
    expect(formatMonth(AT, "ar", { timeZone: RIYADH })).toBe("مارس ٢٠٢٥");
  });

  it("changes only spaces: digits, order, bidi marks and the zone stay", () => {
    expect(plainSpaces("١١:٠٠\u202Fص\u2009–\u2009١٢:٠٠\u00A0م")).toBe("١١:٠٠ ص – ١٢:٠٠ م");
    expect(plainSpaces("\u200F٥٠٪\u061C (GMT+3)")).toBe("\u200F٥٠٪\u061C (GMT+3)");
    expect(plainSpaces("2:30 pm")).toBe("2:30 pm");
  });

  it("counts written with a narrow no-break space come out plain, in both languages' digits", () => {
    const realNumber = Intl.NumberFormat;
    class FakeNumber extends realNumber {
      override format(value: number | bigint) {
        return `${super.format(value)}${NARROW_NBSP}x`;
      }
    }
    vi.stubGlobal("Intl", { ...Intl, NumberFormat: FakeNumber });
    expect(formatCount(1200, "en")).toBe("1,200 x");
    expect(formatCount(1200, "ar")).toBe("١٬٢٠٠ x");
  });
});
