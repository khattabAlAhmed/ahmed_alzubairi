import "server-only";
import type { Database } from "@repo/db";
import {
  localeSchema,
  type Consultation,
  type ConsultationAttachment,
  type ConsultationKind,
  type ConsultationStatus,
  type Locale,
  type Meeting,
  type Permission,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** The caller's own profile, as the routes need it. */
export type OwnProfile = {
  roleId: string | null;
  status: string;
  fullName: string;
  email: string;
  locale: Locale;
};

/** Where an email to one person goes. */
export type Contact = { email: string; locale: Locale; active: boolean };

/** A message as stored: the name is added from the senders' profiles. */
export type StoredMessage = {
  id: string;
  senderId: string;
  body: string | null;
  createdAt: string;
};

/** What the message route checks about an attachment before it links it. */
export type AttachmentState = {
  id: string;
  consultationId: string;
  messageId: string | null;
  status: string;
  uploadedBy: string;
};

export type NewConsultation = {
  clientId: string;
  serviceId: string;
  title: string;
  description: string;
  organization: string | null;
};

/**
 * The database, behind an interface so tests can replace it. The reads of
 * consultations, messages, attachments and meetings use the user client, so
 * RLS scopes them (§7, §9). The service client reads only senders' names and
 * recipients' addresses, after RLS has shown the consultation, and makes the
 * writes, after the route has checked identity and permission.
 */
export type ConsultationStore = {
  /** Every consultation RLS shows the caller, newest first. */
  list: () => Promise<Consultation[]>;
  /** One consultation RLS shows the caller, or null. */
  get: (id: string) => Promise<Consultation | null>;
  /** The consultation's messages in time order (RLS). */
  messages: (id: string) => Promise<StoredMessage[]>;
  /** Its `ready` attachments linked to a message, without the storage key (RLS). */
  attachments: (id: string) => Promise<ConsultationAttachment[]>;
  /** Its meetings, earliest first (RLS). */
  meetings: (id: string) => Promise<Meeting[]>;
  /** `has_permission(key)` for the caller, through their own token. */
  hasPermission: (key: Permission) => Promise<boolean>;
  /** The caller's own profile (RLS), or null. */
  ownProfile: (userId: string) => Promise<OwnProfile | null>;

  /** `full_name` by user id, for the given senders only (service client). */
  senderNames: (ids: string[]) => Promise<Map<string, string>>;
  /** True when the service exists and is published (service client). */
  isPublishedService: (id: string) => Promise<boolean>;
  /** A recipient's address and language (service client), or null. */
  contact: (userId: string) => Promise<Contact | null>;
  /** Inserts a `consultation` with status `new`. */
  create: (row: NewConsultation) => Promise<Consultation>;
  /** The attachments with these ids, whatever their state. */
  attachmentStates: (ids: string[]) => Promise<AttachmentState[]>;
  insertMessage: (row: {
    consultationId: string;
    senderId: string;
    body: string | null;
  }) => Promise<StoredMessage>;
  /**
   * Links the sender's own ready, unlinked attachments on this consultation to
   * the message, in one statement. The number linked.
   */
  linkAttachments: (input: {
    messageId: string;
    consultationId: string;
    uploadedBy: string;
    ids: string[];
  }) => Promise<number>;
  /** Puts the message's attachments back to unlinked. */
  unlinkAttachments: (messageId: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  /** Sets `first_reply_at` once: only while it is null. */
  markFirstReply: (consultationId: string) => Promise<void>;
  /** One unread `notifications` row for a team member. */
  notify: (input: { userId: string; type: string; consultationId: string }) => Promise<void>;
};

const CONSULTATION_COLUMNS =
  "id, kind, client_id, service_id, title, description, organization, status, assigned_to, first_reply_at, closed_at, created_at";

type ConsultationRow = {
  id: string;
  kind: string;
  client_id: string;
  service_id: string | null;
  title: string;
  description: string;
  organization: string | null;
  status: string;
  assigned_to: string | null;
  first_reply_at: string | null;
  closed_at: string | null;
  created_at: string;
};

const iso = (value: string) => new Date(value).toISOString();
const isoOrNull = (value: string | null) => (value === null ? null : iso(value));

export function toConsultation(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    kind: row.kind as ConsultationKind,
    clientId: row.client_id,
    serviceId: row.service_id,
    title: row.title,
    description: row.description,
    organization: row.organization,
    status: row.status as ConsultationStatus,
    assignedTo: row.assigned_to,
    firstReplyAt: isoOrNull(row.first_reply_at),
    closedAt: isoOrNull(row.closed_at),
    createdAt: iso(row.created_at),
  };
}

function fail(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed: ${error.code ?? "error"}`);
}

function localeOf(value: string): Locale {
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? parsed.data : "ar";
}

export function createConsultationStore(user: Client, service: Client): ConsultationStore {
  return {
    async list() {
      const { data, error } = await user
        .from("consultations")
        .select(CONSULTATION_COLUMNS)
        .order("created_at", { ascending: false })
        .order("id");
      if (error) fail("consultation list", error);
      return data.map(toConsultation);
    },

    async get(id) {
      const { data, error } = await user
        .from("consultations")
        .select(CONSULTATION_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) fail("consultation read", error);
      return data ? toConsultation(data) : null;
    },

    async messages(id) {
      const { data, error } = await user
        .from("consultation_messages")
        .select("id, sender_id, body, created_at")
        .eq("consultation_id", id)
        .order("created_at")
        .order("id");
      if (error) fail("message list", error);
      return data.map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        body: row.body,
        createdAt: iso(row.created_at),
      }));
    },

    async attachments(id) {
      // Explicit columns: storage_key is never read here (and isn't granted).
      const { data, error } = await user
        .from("consultation_attachments")
        .select("id, message_id, file_name, mime, size_bytes, uploaded_by, created_at")
        .eq("consultation_id", id)
        .eq("status", "ready")
        .not("message_id", "is", null)
        .order("created_at")
        .order("id");
      if (error) fail("attachment list", error);
      return data.flatMap((row): ConsultationAttachment[] =>
        row.message_id === null
          ? []
          : [
              {
                id: row.id,
                messageId: row.message_id,
                fileName: row.file_name,
                mime: row.mime,
                sizeBytes: row.size_bytes,
                uploadedBy: row.uploaded_by,
                createdAt: iso(row.created_at),
              },
            ],
      );
    },

    async meetings(id) {
      const { data, error } = await user
        .from("meetings")
        .select("id, platform, url, starts_at, duration_minutes, created_at")
        .eq("consultation_id", id)
        .order("starts_at")
        .order("id");
      if (error) fail("meeting list", error);
      return data.map((row) => ({
        id: row.id,
        platform: row.platform,
        url: row.url,
        startsAt: iso(row.starts_at),
        durationMinutes: row.duration_minutes,
        createdAt: iso(row.created_at),
      }));
    },

    async hasPermission(key) {
      const { data, error } = await user.rpc("has_permission", { key });
      if (error) fail("has_permission", error);
      return data === true;
    },

    async ownProfile(userId) {
      // RLS also shows other rows to some members: the filter keeps the caller's own.
      const { data, error } = await user
        .from("profiles")
        .select("role_id, status, full_name, email, locale")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) fail("profile read", error);
      if (!data) return null;
      return {
        roleId: data.role_id,
        status: data.status,
        fullName: data.full_name,
        email: data.email,
        locale: localeOf(data.locale),
      };
    },

    async senderNames(ids) {
      const names = new Map<string, string>();
      if (ids.length === 0) return names;
      const { data, error } = await service
        .from("profiles")
        .select("clerk_user_id, full_name")
        .in("clerk_user_id", ids);
      if (error) fail("sender names", error);
      for (const row of data) names.set(row.clerk_user_id, row.full_name);
      return names;
    },

    async isPublishedService(id) {
      const { data, error } = await service
        .from("services")
        .select("id")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) fail("service read", error);
      return data !== null;
    },

    async contact(userId) {
      const { data, error } = await service
        .from("profiles")
        .select("email, locale, status")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) fail("contact read", error);
      if (!data) return null;
      return { email: data.email, locale: localeOf(data.locale), active: data.status === "active" };
    },

    async create(row) {
      const { data, error } = await service
        .from("consultations")
        .insert({
          kind: "consultation",
          status: "new",
          client_id: row.clientId,
          service_id: row.serviceId,
          title: row.title,
          description: row.description,
          organization: row.organization,
        })
        .select(CONSULTATION_COLUMNS)
        .single();
      if (error) fail("consultation insert", error);
      return toConsultation(data);
    },

    async attachmentStates(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await service
        .from("consultation_attachments")
        .select("id, consultation_id, message_id, status, uploaded_by")
        .in("id", ids);
      if (error) fail("attachment read", error);
      return data.map((row) => ({
        id: row.id,
        consultationId: row.consultation_id,
        messageId: row.message_id,
        status: row.status,
        uploadedBy: row.uploaded_by,
      }));
    },

    async insertMessage(row) {
      const { data, error } = await service
        .from("consultation_messages")
        .insert({
          consultation_id: row.consultationId,
          sender_id: row.senderId,
          body: row.body,
        })
        .select("id, sender_id, body, created_at")
        .single();
      if (error) fail("message insert", error);
      return {
        id: data.id,
        senderId: data.sender_id,
        body: data.body,
        createdAt: iso(data.created_at),
      };
    },

    async linkAttachments({ messageId, consultationId, uploadedBy, ids }) {
      if (ids.length === 0) return 0;
      const { data, error } = await service
        .from("consultation_attachments")
        .update({ message_id: messageId })
        .in("id", ids)
        .eq("consultation_id", consultationId)
        .eq("uploaded_by", uploadedBy)
        .eq("status", "ready")
        .is("message_id", null)
        .select("id");
      if (error) fail("attachment link", error);
      return data.length;
    },

    async unlinkAttachments(messageId) {
      const { error } = await service
        .from("consultation_attachments")
        .update({ message_id: null })
        .eq("message_id", messageId);
      if (error) fail("attachment unlink", error);
    },

    async deleteMessage(id) {
      const { error } = await service.from("consultation_messages").delete().eq("id", id);
      if (error) fail("message delete", error);
    },

    async markFirstReply(consultationId) {
      const { error } = await service
        .from("consultations")
        .update({ first_reply_at: new Date().toISOString() })
        .eq("id", consultationId)
        .is("first_reply_at", null);
      if (error) fail("first reply", error);
    },

    async notify({ userId, type, consultationId }) {
      const { error } = await service.from("notifications").insert({
        user_id: userId,
        type,
        entity: "consultations",
        entity_id: consultationId,
      });
      if (error) fail("notification insert", error);
    },
  };
}
