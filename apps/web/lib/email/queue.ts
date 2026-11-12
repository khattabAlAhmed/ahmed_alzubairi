import "server-only";
import type { Json, TablesInsert } from "@repo/db";
import {
  EMAIL_PAYLOADS,
  isIanaTimeZone,
  isOptionalEmailEvent,
  localeSchema,
  type EmailEvent,
  type EmailPayload,
  type Locale,
  type Permission,
} from "@repo/shared";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { OutboxRow as StoredRow } from "./render";
import { getMailer } from "./resend";
import { sendOutboxRows } from "./send";

/**
 * Queues the emails of §6.21: each one is a `pending` row in `email_outbox`.
 * Once the rows are written, one send is tried right away, after the response,
 * so the caller never waits for it. A send that fails, or that can't be tried
 * because the email keys are missing, leaves the row for the hourly job.
 * Nothing here throws: a failed email never fails the action that caused it.
 * Call these only on the server, after the route has checked identity and
 * permission.
 */

export type EmailRecipient = { email: string; locale: Locale };

type OutboxRow = {
  event: EmailEvent;
  to_email: string;
  locale: Locale;
  payload: Json;
  status: "pending";
};

/** Logs the event and a code only: never an address, a name or a payload. */
function logFailure(event: EmailEvent, reason: string) {
  console.error(`email queue: ${event} not queued (${reason})`);
}

/** A database error's code, or `error` when it has none. Never its message. */
function reasonOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code ? code : "error";
}

/** The payload as its schema reads it, or null when the schema refuses it. */
function checkedPayload(event: EmailEvent, payload: unknown): Json | null {
  const parsed = EMAIL_PAYLOADS[event].safeParse(payload);
  if (!parsed.success) {
    logFailure(event, "invalid_payload");
    return null;
  }
  return parsed.data as Json;
}

/**
 * Tries one send of each new row without making the caller wait: after the
 * response when there is a request (`after` keeps the function alive for it),
 * else in the background. Without the email keys nothing is tried.
 */
function sendSoon(rows: StoredRow[]) {
  if (rows.length === 0 || !getMailer()) return;
  const run = () => sendOutboxRows(rows);
  try {
    after(run);
  } catch {
    // No request to wait for (a script, a test): send in the background.
    void run();
  }
}

/**
 * Writes the rows in one insert, then starts their first send. False, with a
 * log line, when the insert fails.
 */
async function insertRows(event: EmailEvent, rows: OutboxRow[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const { data, error } = await createServiceClient()
    .from("email_outbox")
    .insert(rows)
    .select();
  if (error) {
    logFailure(event, reasonOf(error));
    return false;
  }
  try {
    sendSoon(data);
  } catch (sendError) {
    // The rows are queued: the hourly job sends them.
    logFailure(event, reasonOf(sendError));
  }
  return true;
}

/** What a notification points at, for the dashboard counter's link. */
export type NotificationTarget = { entity: string; entityId: string };

/** The entity a payload points at, for the dashboard counter's link. */
function entityOf(payload: Json): { entity: string; entity_id: string } | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  const { consultationId } = payload;
  return typeof consultationId === "string"
    ? { entity: "consultations", entity_id: consultationId }
    : null;
}

/**
 * Writes one unread `notifications` row per team recipient, for the dashboard
 * counter (§6.21). A failure is logged and nothing more: the emails are
 * already queued.
 */
async function insertNotifications(
  event: EmailEvent,
  userIds: string[],
  payload: Json,
  given?: NotificationTarget,
) {
  if (userIds.length === 0) return;
  const target = given
    ? { entity: given.entity, entity_id: given.entityId }
    : entityOf(payload);
  const rows = userIds.map(
    (user_id): TablesInsert<"notifications"> => ({
      user_id,
      type: event,
      ...target,
    }),
  );
  try {
    const { error } = await createServiceClient().from("notifications").insert(rows);
    if (error) logFailure(event, `notifications_${reasonOf(error)}`);
  } catch (error) {
    logFailure(event, `notifications_${reasonOf(error)}`);
  }
}

/**
 * Queues one email to one address, in that recipient's language, and tries one
 * send after the response. False when the payload doesn't match
 * `EMAIL_PAYLOADS[event]` or the row can't be written; a failed send doesn't
 * change the answer. It takes an address, not a profile, so it can't read a preference:
 * for an optional event (`isOptionalEmailEvent`), the caller checks the
 * recipient's `notify_optional` first and doesn't call this when it is off.
 */
export async function queueEmail<Event extends EmailEvent>(input: {
  event: Event;
  to: EmailRecipient;
  payload: EmailPayload<Event>;
}): Promise<boolean> {
  try {
    const payload = checkedPayload(input.event, input.payload);
    if (payload === null) return false;
    return await insertRows(input.event, [
      {
        event: input.event,
        to_email: input.to.email,
        locale: input.to.locale,
        payload,
        status: "pending",
      },
    ]);
  } catch (error) {
    logFailure(input.event, reasonOf(error));
    return false;
  }
}

/**
 * Queues one email to every active member whose role holds `permission`, each
 * in their own `locale`. A member who turned optional notifications off gets
 * no optional event. A payload with a `timezone` (the meeting events) is
 * written with each member's own time zone, so the date reads right for them.
 * Each recipient also gets one `notifications` row, for the dashboard counter.
 * It points at `target` when one is given, else at the payload's consultation.
 * True when every email row was written, or nobody qualifies.
 */
export async function queueEmailForPermission<Event extends EmailEvent>(
  event: Event,
  permission: Permission,
  payload: EmailPayload<Event>,
  target?: NotificationTarget,
): Promise<boolean> {
  try {
    const checked = checkedPayload(event, payload);
    if (checked === null) return false;

    const service = createServiceClient();
    const roles = await service
      .from("role_permissions")
      .select("role_id")
      .eq("permission", permission);
    if (roles.error) {
      logFailure(event, reasonOf(roles.error));
      return false;
    }
    const roleIds = [...new Set(roles.data.map((row) => row.role_id))];
    if (roleIds.length === 0) return true;

    const members = await service
      .from("profiles")
      .select("clerk_user_id, email, locale, timezone, notify_optional")
      .eq("status", "active")
      .in("role_id", roleIds);
    if (members.error) {
      logFailure(event, reasonOf(members.error));
      return false;
    }

    const optional = isOptionalEmailEvent(event);
    const hasTimezone =
      typeof checked === "object" &&
      checked !== null &&
      !Array.isArray(checked) &&
      "timezone" in checked;
    const recipients = members.data.filter(
      (member) => !optional || member.notify_optional,
    );
    const rows = recipients.map((member): OutboxRow => {
      const locale = localeSchema.safeParse(member.locale);
      return {
        event,
        to_email: member.email,
        locale: locale.success ? locale.data : "ar",
        payload:
          hasTimezone && isIanaTimeZone(member.timezone)
            ? { ...checked, timezone: member.timezone }
            : checked,
        status: "pending",
      };
    });
    if (!(await insertRows(event, rows))) return false;
    // After the emails, so a failed queue leaves no notification behind and a
    // caller's retry can't write a second one.
    await insertNotifications(
      event,
      recipients.map((member) => member.clerk_user_id),
      checked,
      target,
    );
    return true;
  } catch (error) {
    logFailure(event, reasonOf(error));
    return false;
  }
}
