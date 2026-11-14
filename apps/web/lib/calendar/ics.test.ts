import { describe, expect, it } from "vitest";
import { buildMeetingIcs, escapeText, foldLine, icsUtc, meetingUid } from "./ics";

const EVENT = {
  meetingId: "44444444-4444-4444-8444-444444444444",
  sequence: 0,
  startsAt: "2026-11-20T09:00:00.000Z",
  durationMinutes: 45,
  stamp: "2026-11-14T12:00:00.000Z",
  title: "Test consultation; review, part 1",
  platform: "Zoom",
  url: "https://example.invalid/m1",
};

const lines = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");

describe("buildMeetingIcs", () => {
  it("has one VEVENT with a stable UID, SEQUENCE, and times in UTC", () => {
    const ics = buildMeetingIcs(EVENT);
    expect(lines(ics)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//consultations//meetings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:meeting-${EVENT.meetingId}@consultations`,
      "SEQUENCE:0",
      "DTSTAMP:20261114T120000Z",
      "DTSTART:20261120T090000Z",
      "DTEND:20261120T094500Z",
      "SUMMARY:Test consultation\; review\\, part 1",
      "DESCRIPTION:Zoom\\nhttps://example.invalid/m1",
      "LOCATION:https://example.invalid/m1",
      "URL:https://example.invalid/m1",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ]);
  });

  it("keeps the UID on an edit and carries the higher SEQUENCE", () => {
    const first = lines(buildMeetingIcs(EVENT));
    const edited = lines(buildMeetingIcs({ ...EVENT, sequence: 3600, startsAt: "2026-11-20T10:00:00.000Z" }));
    expect(edited.find((line) => line.startsWith("UID:"))).toBe(first.find((line) => line.startsWith("UID:")));
    expect(edited).toContain("SEQUENCE:3600");
    expect(edited).toContain("DTSTART:20261120T100000Z");
  });

  it("ends every line in CRLF and folds long lines at 75 octets, Arabic included", () => {
    const ics = buildMeetingIcs({ ...EVENT, title: "استشارة تجريبية ".repeat(10) });
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(lines(ics).find((line) => line.startsWith("SUMMARY:"))).toBe(`SUMMARY:${"استشارة تجريبية ".repeat(10)}`);
  });

  it("escapes line breaks and backslashes in text, so a value can't start a new property", () => {
    expect(escapeText("a\nEND:VEVENT\\")).toBe("a\\nEND:VEVENT\\\\");
  });

  it("formats UTC times and the UID", () => {
    expect(icsUtc("2026-01-02T03:04:05.678Z")).toBe("20260102T030405Z");
    expect(meetingUid("x")).toBe("meeting-x@consultations");
    expect(foldLine("a".repeat(80))).toBe(`${"a".repeat(75)}\r\n ${"a".repeat(5)}`);
  });
});
