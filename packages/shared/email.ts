import { z } from "zod";
import { type EmailEvent, type Locale } from "./enums";
import {
  httpsUrlSchema,
  shortTextSchema,
  utcDatetimeSchema,
  uuidSchema,
} from "./fields";
import { PERMISSIONS } from "./permissions";

/**
 * A value with one text per language, such as a document's title. The sender
 * picks the recipient's language (`emailValues`).
 */
export const localizedTextSchema = z.strictObject({
  ar: shortTextSchema,
  en: shortTextSchema,
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;

const consultationFields = {
  /** For the link to the consultation. */
  consultationId: uuidSchema,
  title: shortTextSchema,
};

const meetingPayloadSchema = z.strictObject({
  ...consultationFields,
  platform: shortTextSchema,
  url: httpsUrlSchema,
  /** UTC. The sender formats it in the row's `locale` and this `timezone`. */
  startsAt: utcDatetimeSchema,
  /** The recipient's IANA time zone, from their profile. */
  timezone: shortTextSchema,
});

/**
 * What `email_outbox.payload` holds for each event (§6.21). Its keys are the
 * `{{placeholders}}` that event's template may use.
 */
export const EMAIL_PAYLOADS = {
  consultation_new: z.strictObject({
    ...consultationFields,
    clientName: shortTextSchema,
  }),
  consultation_received: z.strictObject(consultationFields),
  consultation_assigned: z.strictObject(consultationFields),
  consultation_reply: z.strictObject(consultationFields),
  meeting: meetingPayloadSchema,
  meeting_reminder: meetingPayloadSchema,
  document_request: z.strictObject({
    documentTitle: localizedTextSchema,
    clientName: shortTextSchema,
  }),
  document_recommendation: z.strictObject({
    documentTitle: localizedTextSchema,
    memberName: shortTextSchema,
  }),
  document_granted: z.strictObject({ documentTitle: localizedTextSchema }),
  course_registration: z.strictObject({
    courseTitle: localizedTextSchema,
    traineeName: shortTextSchema,
  }),
  custom_training_request: z.strictObject({
    orgName: shortTextSchema,
    topic: shortTextSchema,
  }),
  contact_message: z.strictObject({
    name: shortTextSchema,
    subject: shortTextSchema,
  }),
  account_new: z.strictObject({ clientName: shortTextSchema }),
} as const satisfies Record<EmailEvent, z.ZodObject>;

export type EmailPayload<Event extends EmailEvent = EmailEvent> = z.infer<
  (typeof EMAIL_PAYLOADS)[Event]
>;

/** The placeholders each event's template may use: its payload's keys. */
export const EMAIL_PLACEHOLDERS = Object.fromEntries(
  Object.entries(EMAIL_PAYLOADS).map(([event, schema]) => [
    event,
    Object.keys(schema.shape),
  ]),
) as unknown as { readonly [Event in EmailEvent]: readonly string[] };

/**
 * The only emails `profiles.notify_optional = false` turns off (the product
 * owner's decision, 2026-11-11). Every other event is always sent.
 */
export const OPTIONAL_EMAIL_EVENTS = [
  "meeting_reminder",
  "course_registration",
] as const satisfies readonly EmailEvent[];

export function isOptionalEmailEvent(event: EmailEvent): boolean {
  return (OPTIONAL_EMAIL_EVENTS as readonly EmailEvent[]).includes(event);
}

/**
 * "Admin" as a recipient in §6.21 means every active member whose role holds
 * this permission. Never a role name.
 */
export const EMAIL_ADMIN_PERMISSION = PERMISSIONS.TEAM_MANAGE;

/**
 * A `{{placeholder}}` in a template's subject or body. Templates are plain
 * text: this is their only syntax.
 */
export const EMAIL_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

/** The placeholder names a template text uses, each once, in order. */
export function templatePlaceholders(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(EMAIL_PLACEHOLDER_PATTERN)].map(([, name = ""]) => name),
    ),
  ];
}

export type EmailValues = Record<string, string>;

/**
 * A payload as placeholder values in one language: a `{ ar, en }` value
 * becomes its text for `locale`, everything else its string. The sender
 * replaces a date with its formatted text before filling.
 */
export function emailValues(
  payload: Record<string, unknown>,
  locale: Locale,
): EmailValues {
  const values: EmailValues = {};
  for (const [key, value] of Object.entries(payload)) {
    const localized = localizedTextSchema.safeParse(value);
    if (localized.success) values[key] = localized.data[locale];
    else if (typeof value === "string") values[key] = value;
    else if (typeof value === "number") values[key] = String(value);
  }
  return values;
}

/**
 * Fills a template's `{{placeholders}}` in one pass. A placeholder with no
 * string or number value becomes empty, and a value is never read as a
 * template again. The result is plain text, as written: no markup is added and
 * none is taken as markup. Render it as text, never as HTML.
 */
export function fillTemplate(
  text: string,
  payload: Record<string, unknown>,
): string {
  return text.replace(EMAIL_PLACEHOLDER_PATTERN, (_match, name: string) => {
    const value = Object.hasOwn(payload, name) ? payload[name] : undefined;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return "";
  });
}
