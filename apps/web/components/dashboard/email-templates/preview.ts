import {
  EMAIL_PLACEHOLDERS,
  fillTemplate,
  type EmailEvent,
  type EmailValues,
  type Locale,
} from "@repo/shared";
import { EMAIL_ACTIONS } from "@/emails/defaults";
import type { NotificationEmailProps } from "@/emails/notification";
import { formatDateTime } from "@/lib/time/format";

/**
 * The preview's sample values that are words, in the email's language. They
 * come from `DashboardEmailTemplates.samples` in that language's messages.
 */
export type SampleWords = Readonly<Record<string, string>>;

// Sample values that are not words. No real person, meeting or record.
const SAMPLE_URL = "https://meet.example.com/sample";
const SAMPLE_SITE = "https://example.com";
const SAMPLE_CONFIRM_URL = `${SAMPLE_SITE}/api/newsletter/confirm?token=sample`;
const SAMPLE_STARTS_AT = "2027-01-12T07:00:00.000Z";
const SAMPLE_TIMEZONE = "Asia/Aden";
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

/**
 * A sample value for every placeholder of the event, the way the sender
 * builds them: the date and time in the email's language and the sample time
 * zone.
 */
export function sampleValues(
  event: EmailEvent,
  locale: Locale,
  words: SampleWords,
): EmailValues {
  const fixed: EmailValues = {
    consultationId: SAMPLE_ID,
    url: SAMPLE_URL,
    confirmUrl: SAMPLE_CONFIRM_URL,
    timezone: SAMPLE_TIMEZONE,
    startsAt: formatDateTime(SAMPLE_STARTS_AT, locale, { date: "full", timeZone: SAMPLE_TIMEZONE }),
  };
  return Object.fromEntries(
    EMAIL_PLACEHOLDERS[event].map((name) => [
      name,
      fixed[name] ?? words[name] ?? "",
    ]),
  );
}

/**
 * What `NotificationEmail` needs to show a template as the sender would:
 * placeholders filled with sample values, the subject on one line, and the
 * event's button with a sample address. Everything stays plain text.
 */
export function previewEmail(
  event: EmailEvent,
  locale: Locale,
  template: { subject: string; body: string },
  words: SampleWords,
): NotificationEmailProps {
  const values = sampleValues(event, locale, words);
  const action = EMAIL_ACTIONS[event];
  return {
    locale,
    subject: fillTemplate(template.subject, values).replace(/\s+/g, " ").trim(),
    body: fillTemplate(template.body, values).replace(/\r\n?/g, "\n").trim(),
    action: action
      ? {
          href:
            action.kind === "meeting"
              ? SAMPLE_URL
              : action.kind === "confirm"
                ? SAMPLE_CONFIRM_URL
                : `${SAMPLE_SITE}/${locale}${action.path}`,
          label: action.label[locale],
        }
      : undefined,
  };
}
