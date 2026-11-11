import "server-only";
import type { Tables } from "@repo/db";
import {
  emailEventSchema,
  emailValues,
  fillTemplate,
  isIanaTimeZone,
  localeSchema,
  type EmailValues,
  type Locale,
} from "@repo/shared";
import { createServiceClient } from "@/lib/supabase/service";
import { FALLBACK_TEMPLATE, type TemplateText } from "./fallback";

/**
 * Turns an `email_outbox` row into the email to send (§6.21): the template of
 * its event in the recipient's language, with the payload filled in. Templates
 * and payload values are plain text. Nothing here reads either as HTML.
 */

export type OutboxRow = Tables<"email_outbox">;

export type RenderedEmail = { subject: string; text: string; html: string };

/** Thrown when the template can't be read. Carries a code, never row data. */
export class TemplateReadError extends Error {
  constructor(readonly code: string) {
    super(`email template not read (${code})`);
  }
}

/**
 * The template for an event and a language: the `email_templates` row when the
 * dashboard saved one, else the built-in copy. A failed read throws, so a
 * passing database error never sends the wrong copy.
 */
async function loadTemplate(event: string, locale: Locale): Promise<TemplateText> {
  if (!emailEventSchema.safeParse(event).success) return FALLBACK_TEMPLATE[locale];
  const { data, error } = await createServiceClient()
    .from("email_templates")
    .select("subject_ar, subject_en, body_ar, body_en")
    .eq("event", event)
    .maybeSingle();
  if (error) throw new TemplateReadError(error.code || "error");
  if (!data) return FALLBACK_TEMPLATE[locale];
  return locale === "ar"
    ? { subject: data.subject_ar, body: data.body_ar }
    : { subject: data.subject_en, body: data.body_en };
}

/**
 * The payload as placeholder values. `startsAt` (UTC) becomes a date and time
 * in the recipient's language and the payload's `timezone`.
 */
function placeholderValues(payload: unknown, locale: Locale): EmailValues {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {};
  }
  const fields = payload as Record<string, unknown>;
  const values = emailValues(fields, locale);
  const { startsAt, timezone } = fields;
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

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * The plain layout: the text, escaped, one paragraph per blank-line block, in
 * the language's direction. P3T-T12 swaps in the designed layout.
 */
function plainLayout(text: string, locale: Locale): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return (
    `<!doctype html><html lang="${locale}" dir="${dir}">` +
    `<head><meta charset="utf-8"></head>` +
    `<body style="margin:0;padding:24px;font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a">` +
    `<div dir="${dir}" style="max-width:560px;margin:0 auto;text-align:start">${paragraphs}</div>` +
    `</body></html>`
  );
}

/** Renders a row. Throws `TemplateReadError` when the template can't be read. */
export async function renderOutboxRow(row: OutboxRow): Promise<RenderedEmail> {
  const parsedLocale = localeSchema.safeParse(row.locale);
  const locale = parsedLocale.success ? parsedLocale.data : "ar";
  const template = await loadTemplate(row.event, locale);
  const values = placeholderValues(row.payload, locale);
  // A subject is one line: a line break in a value must not start a header.
  const subject = fillTemplate(template.subject, values)
    .replace(/\s+/g, " ")
    .trim();
  const text = fillTemplate(template.body, values).replace(/\r\n?/g, "\n").trim();
  return { subject, text, html: plainLayout(text, locale) };
}
