import "server-only";
import type { Database } from "@repo/db";
import { isOptionalEmailEvent, type ConsultationStatus } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { queueEmail } from "@/lib/email/queue";
import { zoneOf } from "./handlers";
import { readRecipient, type Recipient } from "./store";

/** Meetings starting this far ahead get their reminder (§6.17: 24 hours, ±1 for the hourly run). */
export const REMINDER_WINDOW = { fromMs: 23 * 60 * 60 * 1000, toMs: 25 * 60 * 60 * 1000 } as const;

export type DueMeeting = {
  consultationId: string;
  platform: string;
  url: string;
  startsAt: string;
};

export type ReminderDb = {
  /**
   * Sets `reminder_sent_at` on every meeting starting in the window that has
   * none, and returns them, in one statement. Two runs at once can't both
   * claim the same meeting.
   */
  claimDue: (from: string, to: string) => Promise<DueMeeting[]>;
  consultation: (id: string) => Promise<{
    title: string;
    clientId: string;
    assignedTo: string | null;
    status: ConsultationStatus;
  } | null>;
  recipient: (userId: string) => Promise<Recipient | null>;
};

export function createReminderDb(service: SupabaseClient<Database>): ReminderDb {
  return {
    async claimDue(from, to) {
      const { data, error } = await service
        .from("meetings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .is("reminder_sent_at", null)
        .gte("starts_at", from)
        .lte("starts_at", to)
        .select("consultation_id, platform, url, starts_at");
      if (error) throw new Error(`reminder claim failed: ${error.code}`);
      return data.map((row) => ({
        consultationId: row.consultation_id,
        platform: row.platform,
        url: row.url,
        startsAt: new Date(row.starts_at).toISOString(),
      }));
    },

    async consultation(id) {
      const { data, error } = await service
        .from("consultations")
        .select("title, client_id, assigned_to, status")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`reminder consultation read failed: ${error.code}`);
      return data
        ? {
            title: data.title,
            clientId: data.client_id,
            assignedTo: data.assigned_to,
            status: data.status as ConsultationStatus,
          }
        : null;
    },

    async recipient(userId) {
      const { data, error } = await service
        .from("profiles")
        .select("email, locale, timezone, notify_optional, status")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`reminder recipient read failed: ${error.code}`);
      return data ? readRecipient(data) : null;
    },
  };
}

/**
 * The hourly job's meeting reminders (§6.17 Reminder): `meeting_reminder` to
 * the client and the assigned member, for meetings starting in 23 to 25 hours.
 * Each meeting is claimed first (`reminder_sent_at` set in the same statement
 * that picks it), so it is reminded once even when two runs overlap. A
 * recipient who turned optional emails off, or whose account is disabled, is
 * skipped; so is a closed consultation. Each email uses the recipient's
 * language and saved zone.
 */
export async function sendMeetingReminders(
  db: ReminderDb,
  queue: typeof queueEmail,
  now: number = Date.now(),
): Promise<{ meetings: number; emails: number }> {
  const due = await db.claimDue(
    new Date(now + REMINDER_WINDOW.fromMs).toISOString(),
    new Date(now + REMINDER_WINDOW.toMs).toISOString(),
  );
  let emails = 0;
  for (const meeting of due) {
    const consultation = await db.consultation(meeting.consultationId);
    if (!consultation || consultation.status === "closed") continue;
    const people = [consultation.clientId, consultation.assignedTo].filter(
      (id): id is string => id !== null,
    );
    for (const userId of new Set(people)) {
      const person = await db.recipient(userId);
      if (!person?.active) continue;
      if (isOptionalEmailEvent("meeting_reminder") && !person.notifyOptional) continue;
      const queued = await queue({
        event: "meeting_reminder",
        to: { email: person.email, locale: person.locale },
        payload: {
          consultationId: meeting.consultationId,
          title: consultation.title,
          platform: meeting.platform,
          url: meeting.url,
          startsAt: meeting.startsAt,
          timezone: zoneOf(person.timezone),
        },
      });
      if (queued) emails += 1;
    }
  }
  return { meetings: due.length, emails };
}
