/**
 * A calendar file (RFC 5545) for one meeting (§6.17 Calendar file). Plain
 * text: every value is escaped, lines end in CRLF and are folded at 75 octets.
 * Times are UTC (the `Z` form), so every calendar app shows them in its own
 * zone.
 */

export type MeetingEvent = {
  /** The meeting's id: the UID stays the same for every email about it. */
  meetingId: string;
  /** Higher on each later email, so a calendar replaces the older copy. */
  sequence: number;
  /** UTC, ISO 8601. */
  startsAt: string;
  durationMinutes: number;
  /** When this copy was made, UTC, ISO 8601. */
  stamp: string;
  title: string;
  platform: string;
  url: string;
};

/** The UID of a meeting's event: the same for its first email and every edit. */
export function meetingUid(meetingId: string): string {
  return `meeting-${meetingId}@consultations`;
}

/** `20261115T090000Z` */
export function icsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Escapes a TEXT value: backslash, semicolon, comma and line breaks. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line at 75 octets, never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // The first line holds 75 octets; each continuation holds 74 after its space.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The `.ics` text for a meeting: one VEVENT, METHOD:PUBLISH. */
export function buildMeetingIcs(event: MeetingEvent): string {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//consultations//meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meetingUid(event.meetingId)}`,
    `SEQUENCE:${Math.max(0, Math.floor(event.sequence))}`,
    `DTSTAMP:${icsUtc(event.stamp)}`,
    `DTSTART:${icsUtc(start.toISOString())}`,
    `DTEND:${icsUtc(end.toISOString())}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(`${event.platform}\n${event.url}`)}`,
    `LOCATION:${escapeText(event.url)}`,
    `URL:${event.url}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
