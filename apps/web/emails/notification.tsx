import type { Locale } from "@repo/shared";
import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./components";
import { EMAIL_DEFAULTS, EMAIL_FOOTER } from "./defaults";

export type NotificationEmailProps = {
  /** The recipient's language. */
  locale: Locale;
  /** The filled subject, as plain text. */
  subject: string;
  /** The filled body, as plain text. A blank line starts a new paragraph. */
  body: string;
  /** The email's one button. `href` must already be a checked http(s) link. */
  action?: { href: string; label: string };
};

/** A subject without its `[tag]`, for the title inside the email. */
export function titleOf(subject: string): string {
  return subject.replace(/^\s*\[[^\]]*\]\s*/, "") || subject;
}

/** The body's paragraphs: blocks split by blank lines, empty ones dropped. */
export function paragraphsOf(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/**
 * Every notification email (§6.21): the subject as the title, the body as
 * paragraphs and an optional button, inside the shared layout. The subject
 * and body are text. They come from a template and a payload, so nothing in
 * them is ever rendered as HTML: React escapes each one.
 */
export function NotificationEmail({
  locale,
  subject,
  body,
  action,
}: NotificationEmailProps) {
  const paragraphs = paragraphsOf(body);

  return (
    <EmailLayout
      locale={locale}
      preview={paragraphs[0] ?? subject}
      footer={EMAIL_FOOTER[locale]}
    >
      <EmailHeading>
        {/* A title may be in the other language: let it set its own direction. */}
        <span dir="auto">{titleOf(subject)}</span>
      </EmailHeading>
      {paragraphs.map((paragraph, index) => (
        <EmailText key={index}>{paragraph}</EmailText>
      ))}
      {action ? (
        <EmailButton href={action.href}>{action.label}</EmailButton>
      ) : null}
    </EmailLayout>
  );
}

const sample = EMAIL_DEFAULTS.contact_message.ar;

NotificationEmail.PreviewProps = {
  locale: "ar",
  subject: sample.subject,
  body: sample.body,
  action: { href: "https://example.com/ar/dashboard/messages", label: "عرض الرسائل" },
} satisfies NotificationEmailProps;

export default NotificationEmail;
