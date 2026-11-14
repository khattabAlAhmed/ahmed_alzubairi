import "server-only";
import { EMAIL_PAYLOADS } from "@repo/shared";
import { buildMeetingIcs } from "@/lib/calendar/ics";
import { createServiceClient } from "@/lib/supabase/service";
import type { OutboxRow } from "./render";

/** An email attachment as Resend takes it. */
export type EmailAttachment = { filename: string; content: string; contentType: string };

export const ICS_FILENAME = "meeting.ics";

type MeetingRow = { id: string; duration_minutes: number; created_at: string };

/** Finds the meeting a payload describes: its consultation, start and link. */
export type FindMeeting = (input: {
  consultationId: string;
  startsAt: string;
  url: string;
}) => Promise<MeetingRow | null>;

const findMeeting: FindMeeting = async ({ consultationId, startsAt, url }) => {
  const { data, error } = await createServiceClient()
    .from("meetings")
    .select("id, duration_minutes, created_at")
    .eq("consultation_id", consultationId)
    .eq("starts_at", startsAt)
    .eq("url", url)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`meeting read failed: ${error.code}`);
  return data[0] ?? null;
};

/**
 * The `.ics` for a `meeting` email (§6.17 Calendar file), rendered when the
 * row is sent. `email_outbox` holds only the payload, and the shared `meeting`
 * payload has no meeting id, so the meeting is found from the payload's
 * consultation, start and link: the values it had when the email was queued.
 *
 * - UID: from the meeting id, the same for the first email and every edit.
 * - SEQUENCE: seconds from the meeting's creation to the row's creation. Each
 *   later edit queues a later row, so the number only grows, and a retry of
 *   the same row keeps it.
 *
 * Null for any other event, or when the meeting changed again before this
 * row was sent (a newer email carries the newer file). The email still goes.
 */
export async function meetingAttachment(
  row: OutboxRow,
  find: FindMeeting = findMeeting,
): Promise<EmailAttachment | null> {
  if (row.event !== "meeting") return null;
  const payload = EMAIL_PAYLOADS.meeting.safeParse(row.payload);
  if (!payload.success) return null;
  const { consultationId, startsAt, url, title, platform } = payload.data;
  const meeting = await find({ consultationId, startsAt, url });
  if (!meeting) return null;
  const sequence = Math.floor(
    (Date.parse(row.created_at) - Date.parse(meeting.created_at)) / 1000,
  );
  return {
    filename: ICS_FILENAME,
    content: buildMeetingIcs({
      meetingId: meeting.id,
      sequence: Number.isFinite(sequence) ? Math.max(0, sequence) : 0,
      startsAt,
      durationMinutes: meeting.duration_minutes,
      stamp: row.created_at,
      title,
      platform,
      url,
    }),
    contentType: "text/calendar; charset=utf-8; method=PUBLISH",
  };
}
