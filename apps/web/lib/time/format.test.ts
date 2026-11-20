import { describe, expect, it } from "vitest";
import { formatCount, formatDateTime, formatMonth, formatTimeRange, zoneLabel } from "./format";

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
    expect(formatTimeRange(AT, end, "en", RIYADH)).toMatch(/^2:30\s–\s3:30\spm$/);
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
