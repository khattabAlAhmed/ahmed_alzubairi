import "server-only";
import type { Json } from "@repo/db";
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
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Queues the emails of §6.21: each one is a `pending` row in `email_outbox`,
 * which the sender picks up. Nothing here sends, and nothing here throws: a
 * failed email never fails the action that caused it. Call these only on the
 * server, after the route has checked identity and permission.
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

/** Writes the rows in one insert. False, with a log line, when it fails. */
async function insertRows(event: EmailEvent, rows: OutboxRow[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const { error } = await createServiceClient().from("email_outbox").insert(rows);
  if (error) {
    logFailure(event, reasonOf(error));
    return false;
  }
  return true;
}

/**
 * Queues one email to one address, in that recipient's language. False when
 * the payload doesn't match `EMAIL_PAYLOADS[event]` or the row can't be
 * written. It takes an address, not a profile, so it can't read a preference:
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
 * True when every row was written, or nobody qualifies.
 */
export async function queueEmailForPermission<Event extends EmailEvent>(
  event: Event,
  permission: Permission,
  payload: EmailPayload<Event>,
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
      .select("email, locale, timezone, notify_optional")
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
    const rows = members.data
      .filter((member) => !optional || member.notify_optional)
      .map((member): OutboxRow => {
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
    return await insertRows(event, rows);
  } catch (error) {
    logFailure(event, reasonOf(error));
    return false;
  }
}
