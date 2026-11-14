import {
  EMAIL_EVENTS,
  EMAIL_PLACEHOLDERS,
  emailEventSchema,
  templatePlaceholders,
  type EmailEvent,
  type EmailTemplate,
} from "@repo/shared";
import { EMAIL_DEFAULTS } from "@/emails/defaults";

/**
 * The template editor's rules (§6.21), with no database and no server code,
 * so the routes and the form share them.
 */

/** A template as the editor shows it: the saved row, or the default copy. */
export type EmailTemplateEntry = EmailTemplate & {
  /** True when `email_templates` has a row for the event. */
  edited: boolean;
};

/** What `GET /api/admin/email-templates` answers. */
export type EmailTemplateEntryList = { templates: EmailTemplateEntry[] };

/** The four texts of a template, by their request field. */
export const TEMPLATE_FIELDS = [
  "subjectAr",
  "subjectEn",
  "bodyAr",
  "bodyEn",
] as const;

export type TemplateField = (typeof TEMPLATE_FIELDS)[number];

/** The default copy of an event, from `emails/defaults.ts`. */
export function defaultTemplate(event: EmailEvent): EmailTemplate {
  const { ar, en } = EMAIL_DEFAULTS[event];
  return {
    event,
    subjectAr: ar.subject,
    subjectEn: en.subject,
    bodyAr: ar.body,
    bodyEn: en.body,
  };
}

/**
 * Every event in §6.21's order: its saved row when there is one, else the
 * default copy. A saved row for an event this build doesn't know is left out.
 */
export function templateEntries(
  saved: readonly EmailTemplate[],
): EmailTemplateEntry[] {
  const byEvent = new Map(
    saved
      .filter((row) => emailEventSchema.safeParse(row.event).success)
      .map((row) => [row.event, row]),
  );
  return EMAIL_EVENTS.map((event) => {
    const row = byEvent.get(event);
    return row
      ? { ...row, edited: true }
      : { ...defaultTemplate(event), edited: false };
  });
}

/**
 * The placeholders a text uses that the event's payload doesn't have
 * (`EMAIL_PAYLOADS`), each once, in order. The sender would fill them with
 * nothing, so the routes refuse them.
 */
export function unknownPlaceholders(event: EmailEvent, text: string): string[] {
  const allowed = EMAIL_PLACEHOLDERS[event];
  return templatePlaceholders(text).filter((name) => !allowed.includes(name));
}

/** `{{name}}`, as it is typed in a template. */
export function placeholderToken(name: string): string {
  return `{{${name}}}`;
}

/** The unknown placeholders of each text of a template, fields without any left out. */
export function unknownByField(
  event: EmailEvent,
  texts: Readonly<Record<TemplateField, string>>,
): Partial<Record<TemplateField, string[]>> {
  const found: Partial<Record<TemplateField, string[]>> = {};
  for (const field of TEMPLATE_FIELDS) {
    const names = unknownPlaceholders(event, texts[field]);
    if (names.length > 0) found[field] = names;
  }
  return found;
}
