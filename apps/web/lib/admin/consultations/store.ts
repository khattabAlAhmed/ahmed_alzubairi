import "server-only";
import type { Database } from "@repo/db";
import {
  localeSchema,
  PERMISSIONS,
  type ConsultationStatus,
  type Locale,
  type Meeting,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createConsultationStore, type ConsultationStore } from "@/lib/consultations/store";

type Client = SupabaseClient<Database>;

/** Where and how an email to one person goes: their address, language and zone. */
export type Recipient = {
  email: string;
  locale: Locale;
  /** `profiles.timezone`: the sender checks it is a real IANA zone. */
  timezone: string;
  notifyOptional: boolean;
  active: boolean;
};

export type MeetingFields = {
  platform: string;
  url: string;
  startsAt: string;
  durationMinutes: number;
};

/**
 * The team's consultation writes, behind an interface so tests can replace
 * them. `get` and `hasPermission` are T03's: the user client, so RLS decides
 * what the member sees and the database decides their permissions. The rest
 * use the service client, only after the handler's checks.
 */
export type AdminConsultationStore = Pick<ConsultationStore, "get" | "hasPermission" | "notify"> & {
  /** A profile's address, language, zone and preference (service client), or null. */
  recipient: (userId: string) => Promise<Recipient | null>;
  /** True for an active member whose role holds `consultations.reply`. */
  isEligibleAssignee: (userId: string) => Promise<boolean>;
  /**
   * Changes the status only while it is still `from`. Closing sets
   * `closed_at`. False when nothing was written.
   */
  setStatus: (id: string, from: ConsultationStatus, to: ConsultationStatus) => Promise<boolean>;
  /** Changes the assignee only while it is still `from`. False when nothing was written. */
  setAssignee: (id: string, from: string | null, to: string | null) => Promise<boolean>;
  createMeeting: (consultationId: string, fields: MeetingFields) => Promise<Meeting>;
  /** A meeting of this consultation, or null. */
  getMeeting: (meetingId: string, consultationId: string) => Promise<Meeting | null>;
  /**
   * Writes the changed fields. A new start clears `reminder_sent_at`, so the
   * reminder goes out again for the new time. Null when the meeting is gone.
   */
  updateMeeting: (
    meetingId: string,
    consultationId: string,
    changes: Partial<MeetingFields>,
  ) => Promise<Meeting | null>;
};

const MEETING_COLUMNS = "id, platform, url, starts_at, duration_minutes, created_at";

type MeetingRow = {
  id: string;
  platform: string;
  url: string;
  starts_at: string;
  duration_minutes: number;
  created_at: string;
};

export function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    platform: row.platform,
    url: row.url,
    startsAt: new Date(row.starts_at).toISOString(),
    durationMinutes: row.duration_minutes,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function fail(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed: ${error.code ?? "error"}`);
}

export function readRecipient(row: {
  email: string;
  locale: string;
  timezone: string;
  notify_optional: boolean;
  status: string;
}): Recipient {
  const locale = localeSchema.safeParse(row.locale);
  return {
    email: row.email,
    locale: locale.success ? locale.data : "ar",
    timezone: row.timezone,
    notifyOptional: row.notify_optional,
    active: row.status === "active",
  };
}

export function createAdminConsultationStore(user: Client, service: Client): AdminConsultationStore {
  const base = createConsultationStore(user, service);
  return {
    get: base.get,
    hasPermission: base.hasPermission,
    notify: base.notify,

    async recipient(userId) {
      const { data, error } = await service
        .from("profiles")
        .select("email, locale, timezone, notify_optional, status")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) fail("recipient read", error);
      return data ? readRecipient(data) : null;
    },

    async isEligibleAssignee(userId) {
      const { data, error } = await service
        .from("profiles")
        .select("role_id, status")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) fail("assignee read", error);
      if (!data || data.status !== "active" || data.role_id === null) return false;
      const held = await service
        .from("role_permissions")
        .select("permission")
        .eq("role_id", data.role_id)
        .eq("permission", PERMISSIONS.CONSULTATIONS_REPLY)
        .maybeSingle();
      if (held.error) fail("assignee permission read", held.error);
      return held.data !== null;
    },

    async setStatus(id, from, to) {
      const { data, error } = await service
        .from("consultations")
        .update({ status: to, ...(to === "closed" ? { closed_at: new Date().toISOString() } : {}) })
        .eq("id", id)
        .eq("status", from)
        .select("id");
      if (error) fail("status change", error);
      return data.length === 1;
    },

    async setAssignee(id, from, to) {
      let query = service.from("consultations").update({ assigned_to: to }).eq("id", id);
      query = from === null ? query.is("assigned_to", null) : query.eq("assigned_to", from);
      const { data, error } = await query.select("id");
      if (error) fail("assignment", error);
      return data.length === 1;
    },

    async createMeeting(consultationId, fields) {
      const { data, error } = await service
        .from("meetings")
        .insert({
          consultation_id: consultationId,
          platform: fields.platform,
          url: fields.url,
          starts_at: fields.startsAt,
          duration_minutes: fields.durationMinutes,
        })
        .select(MEETING_COLUMNS)
        .single();
      if (error) fail("meeting insert", error);
      return toMeeting(data);
    },

    async getMeeting(meetingId, consultationId) {
      const { data, error } = await service
        .from("meetings")
        .select(MEETING_COLUMNS)
        .eq("id", meetingId)
        .eq("consultation_id", consultationId)
        .maybeSingle();
      if (error) fail("meeting read", error);
      return data ? toMeeting(data) : null;
    },

    async updateMeeting(meetingId, consultationId, changes) {
      const row: Database["public"]["Tables"]["meetings"]["Update"] = {};
      if (changes.platform !== undefined) row.platform = changes.platform;
      if (changes.url !== undefined) row.url = changes.url;
      if (changes.durationMinutes !== undefined) row.duration_minutes = changes.durationMinutes;
      if (changes.startsAt !== undefined) {
        row.starts_at = changes.startsAt;
        row.reminder_sent_at = null;
      }
      const { data, error } = await service
        .from("meetings")
        .update(row)
        .eq("id", meetingId)
        .eq("consultation_id", consultationId)
        .select(MEETING_COLUMNS)
        .maybeSingle();
      if (error) fail("meeting update", error);
      return data ? toMeeting(data) : null;
    },
  };
}
