import {
  updateEmailTemplateRequestSchema,
  type EmailEvent,
  type EmailTemplate,
  type Locale,
  type OkResponse,
} from "@repo/shared";
import arMessages from "@/messages/ar/DashboardEmailTemplates.json";
import enMessages from "@/messages/en/DashboardEmailTemplates.json";
import type { AuditEntry } from "../audit";
import { baseError, type AdminError } from "../permissions";
import {
  placeholderToken,
  templateEntries,
  unknownByField,
  type EmailTemplateEntryList,
} from "./templates";

const MESSAGES = { ar: arMessages, en: enMessages };

/**
 * The database, behind an interface so tests can replace it. Created only
 * after `requirePermission(team.manage)` passed.
 */
export type EmailTemplateStore = {
  /** The saved rows, read with the member's own client (RLS). */
  list: () => Promise<EmailTemplate[]>;
  /** Inserts or replaces one event's row. */
  upsert: (template: EmailTemplate) => Promise<void>;
  /** Deletes one event's row, if there is one. */
  remove: (event: EmailEvent) => Promise<void>;
};

export type EmailTemplateDeps = {
  locale: Locale;
  userId: string;
  store: EmailTemplateStore;
  audit: (entry: AuditEntry) => Promise<void>;
};

/**
 * `DELETE /api/admin/email-templates`: the event to reset, and nothing else
 * (the PATCH schema's `event`, still strict). It lives here
 * because this task can't change `packages/shared`; it moves there with the
 * route's entry in `API_ROUTES`.
 */
export const resetEmailTemplateRequestSchema =
  updateEmailTemplateRequestSchema.pick({ event: true });

/** `GET /api/admin/email-templates`: every event, saved or default. */
export async function listEmailTemplates({
  store,
}: Pick<EmailTemplateDeps, "store">): Promise<{
  status: 200;
  body: EmailTemplateEntryList;
}> {
  return { status: 200, body: { templates: templateEntries(await store.list()) } };
}

/** The refusal for placeholders the event doesn't have, naming each one. */
function unknownPlaceholderError(names: string[], locale: Locale): AdminError {
  const list = names.map(placeholderToken).join(locale === "ar" ? "، " : ", ");
  return {
    status: 400,
    body: {
      error: {
        code: "validation_failed",
        message: MESSAGES[locale].errors.unknownPlaceholder.replace(
          "{names}",
          list,
        ),
      },
    },
  };
}

/**
 * The log row of a template change: who and which event. Never the subject
 * or the body.
 */
function auditEntry(userId: string, event: EmailEvent, reset: boolean): AuditEntry {
  return {
    actorId: userId,
    action: "email_template.update",
    entity: "email_templates",
    entityId: event,
    metadata: { event, reset },
  };
}

/**
 * `PATCH /api/admin/email-templates`, after the permission check: saves one
 * event's template. A subject or body that uses a placeholder the event's
 * payload doesn't have is refused, and nothing is written.
 */
export async function updateEmailTemplate(
  rawBody: unknown,
  { locale, userId, store, audit }: EmailTemplateDeps,
): Promise<{ status: 200; body: OkResponse } | AdminError> {
  const body = updateEmailTemplateRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);
  const template = body.data;

  const unknown = [
    ...new Set(Object.values(unknownByField(template.event, template)).flat()),
  ];
  if (unknown.length > 0) return unknownPlaceholderError(unknown, locale);

  await store.upsert(template);
  await audit(auditEntry(userId, template.event, false));
  return { status: 200, body: { ok: true } };
}

/**
 * `DELETE /api/admin/email-templates`, after the permission check: "Reset to
 * default". Deletes the event's row, so the default copy is sent again.
 * Resetting an event that has no row is not an error.
 */
export async function resetEmailTemplate(
  rawBody: unknown,
  { locale, userId, store, audit }: EmailTemplateDeps,
): Promise<{ status: 200; body: OkResponse } | AdminError> {
  const body = resetEmailTemplateRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);

  await store.remove(body.data.event);
  await audit(auditEntry(userId, body.data.event, true));
  return { status: 200, body: { ok: true } };
}
