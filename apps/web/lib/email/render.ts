import "server-only";
import type { Tables } from "@repo/db";
import { render } from "@react-email/render";
import {
  emailEventSchema,
  emailValues,
  fillTemplate,
  isIanaTimeZone,
  localeSchema,
  type EmailEvent,
  type EmailValues,
  type Locale,
  SITE_NAME,
} from "@repo/shared";
import { createElement } from "react";
import {
  EMAIL_ACTIONS,
  EMAIL_DEFAULTS,
  EMAIL_FOOTER,
  GENERIC_TEMPLATE,
  type TemplateText,
} from "@/emails/defaults";
import { NotificationEmail } from "@/emails/notification";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Turns an `email_outbox` row into the email to send (§6.21): the template of
 * its event in the recipient's language, with the payload filled in, inside
 * the shared layout. Templates and payload values are plain text. Nothing here
 * reads either as HTML.
 */

export type OutboxRow = Tables<"email_outbox">;

export type RenderedEmail = { subject: string; text: string; html: string };

/** Thrown when the template can't be read. Carries a code, never row data. */
export class TemplateReadError extends Error {
  constructor(readonly code: string) {
    super(`email template not read (${code})`);
  }
}

/** The event when this build knows it, else null. */
function knownEvent(event: string): EmailEvent | null {
  const parsed = emailEventSchema.safeParse(event);
  return parsed.success ? parsed.data : null;
}

/**
 * The template for an event and a language: the `email_templates` row when the
 * dashboard saved one, else the default copy in `emails/defaults.ts`. A failed
 * read throws, so a passing database error never sends the wrong copy.
 */
async function loadTemplate(
  event: EmailEvent | null,
  locale: Locale,
): Promise<TemplateText> {
  if (!event) return GENERIC_TEMPLATE[locale];
  const { data, error } = await createServiceClient()
    .from("email_templates")
    .select("subject_ar, subject_en, body_ar, body_en")
    .eq("event", event)
    .maybeSingle();
  if (error) throw new TemplateReadError(error.code || "error");
  if (!data) return EMAIL_DEFAULTS[event][locale];
  return locale === "ar"
    ? { subject: data.subject_ar, body: data.body_ar }
    : { subject: data.subject_en, body: data.body_en };
}

/**
 * The payload as placeholder values. `startsAt` (UTC) becomes a date and time
 * in the recipient's language and the payload's `timezone`. A `url` that isn't
 * an https link becomes empty, so the body never spells out a link the button
 * refused.
 */
function placeholderValues(payload: unknown, locale: Locale): EmailValues {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {};
  }
  const fields = payload as Record<string, unknown>;
  const values = emailValues(fields, locale);
  const { startsAt, timezone } = fields;
  if ("url" in fields) values.url = webLink(fields.url, ["https:"]) ?? "";
  if (typeof startsAt === "string" && !Number.isNaN(Date.parse(startsAt))) {
    values.startsAt = new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone:
        typeof timezone === "string" && isIanaTimeZone(timezone) ? timezone : "UTC",
    }).format(new Date(startsAt));
  }
  return values;
}

/** An absolute http(s) link, normalized, or null for anything else. */
function webLink(value: unknown, protocols: readonly string[]): string | null {
  if (typeof value !== "string" || !URL.canParse(value)) return null;
  const url = new URL(value);
  return protocols.includes(url.protocol) ? url.href : null;
}

/**
 * The site's address from `NEXT_PUBLIC_APP_URL`: its origin and path, without
 * a trailing slash. A query or a fragment is dropped, so a path can be added.
 */
function appUrl(): string | null {
  // Read by name at send time, so the build doesn't fix its value.
  const link = webLink(process.env["NEXT_PUBLIC_APP_URL"], ["https:", "http:"]);
  if (!link) return null;
  const { origin, pathname } = new URL(link);
  return `${origin}${pathname.replace(/\/+$/, "")}`;
}

/**
 * The email's button: a page of the site in the recipient's language, or the
 * meeting's own link. None when the event has no button, the site's address
 * isn't set, or the meeting link isn't https: the email is still sent.
 */
function actionOf(
  event: EmailEvent | null,
  payload: unknown,
  locale: Locale,
): { href: string; label: string } | undefined {
  const action = event ? EMAIL_ACTIONS[event] : null;
  if (!action) return undefined;
  const href =
    action.kind === "meeting"
      ? webLink((payload as { url?: unknown } | null)?.url, ["https:"])
      : (() => {
          const base = appUrl();
          return base ? `${base}/${locale}${action.path}` : null;
        })();
  return href ? { href, label: action.label[locale] } : undefined;
}

/** Renders a row. Throws `TemplateReadError` when the template can't be read. */
export async function renderOutboxRow(row: OutboxRow): Promise<RenderedEmail> {
  const parsedLocale = localeSchema.safeParse(row.locale);
  const locale = parsedLocale.success ? parsedLocale.data : "ar";
  const event = knownEvent(row.event);
  const template = await loadTemplate(event, locale);
  const values = placeholderValues(row.payload, locale);
  // A subject is one line: a line break in a value must not start a header.
  const subject = fillTemplate(template.subject, values)
    .replace(/\s+/g, " ")
    .trim();
  const body = fillTemplate(template.body, values).replace(/\r\n?/g, "\n").trim();
  const action = actionOf(event, row.payload, locale);
  const html = await render(
    createElement(NotificationEmail, { locale, subject, body, action }),
  );
  // The plain-text part: the same words as the layout. The site's name, the
  // body, the button as a line of its own unless the body already spells the
  // link out (a meeting's does), then the footer.
  const text = [
    SITE_NAME,
    body,
    action && !body.includes(action.href)
      ? `${action.label}: ${action.href}`
      : null,
    EMAIL_FOOTER[locale],
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, text, html };
}
