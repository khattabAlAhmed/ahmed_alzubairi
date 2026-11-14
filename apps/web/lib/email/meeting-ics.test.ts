import { describe, expect, it, vi } from "vitest";
import { meetingAttachment } from "./meeting-ics";
import type { OutboxRow } from "./render";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const MEETING = "44444444-4444-4444-8444-444444444444";
const PAYLOAD = {
  consultationId: "11111111-1111-4111-8111-111111111111",
  title: "Test consultation",
  platform: "Zoom",
  url: "https://example.invalid/m1",
  startsAt: "2026-11-20T09:00:00.000Z",
  timezone: "Asia/Riyadh",
};

function row(over: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    event: "meeting",
    to_email: "client@example.invalid",
    locale: "ar",
    payload: PAYLOAD,
    status: "pending",
    attempts: 0,
    last_error: null,
    created_at: "2026-11-14T12:00:05.000Z",
    sent_at: null,
    ...over,
  } as OutboxRow;
}

const found = vi.fn(async () => ({ id: MEETING, duration_minutes: 45, created_at: "2026-11-14T12:00:00.000Z" }));

describe("meetingAttachment", () => {
  it("renders the .ics from the meeting the payload describes", async () => {
    const attachment = await meetingAttachment(row(), found);
    expect(found).toHaveBeenCalledWith({ consultationId: PAYLOAD.consultationId, startsAt: PAYLOAD.startsAt, url: PAYLOAD.url });
    expect(attachment).toMatchObject({ filename: "meeting.ics", contentType: "text/calendar; charset=utf-8; method=PUBLISH" });
    const text = attachment!.content;
    expect(text).toContain(`UID:meeting-${MEETING}@consultations`);
    expect(text).toContain("DTSTART:20261120T090000Z");
    expect(text).toContain("DTEND:20261120T094500Z");
    // Five seconds after the meeting was made.
    expect(text).toContain("SEQUENCE:5");
  });

  it("a later row (an edit) gets a higher SEQUENCE and the same UID", async () => {
    const first = (await meetingAttachment(row(), found))!.content;
    const later = (await meetingAttachment(row({ created_at: "2026-11-14T13:00:00.000Z" }), found))!.content;
    expect(later).toContain("SEQUENCE:3600");
    expect(later.match(/UID:.*/)?.[0]).toBe(first.match(/UID:.*/)?.[0]);
  });

  it("returns nothing for another event, a bad payload, or a meeting changed since", async () => {
    expect(await meetingAttachment(row({ event: "meeting_reminder" }), found)).toBeNull();
    expect(await meetingAttachment(row({ payload: { title: "x" } }), found)).toBeNull();
    expect(await meetingAttachment(row(), async () => null)).toBeNull();
  });
});
