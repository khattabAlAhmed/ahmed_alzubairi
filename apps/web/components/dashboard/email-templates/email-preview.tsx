"use client";

import { render } from "@react-email/render";
import type { EmailEvent, Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { NotificationEmail } from "@/emails/notification";
import arMessages from "@/messages/ar/DashboardEmailTemplates.json";
import enMessages from "@/messages/en/DashboardEmailTemplates.json";
import { previewEmail } from "./preview";

// The sample values are in the email's language, not the page's.
const SAMPLES = { ar: arMessages.samples, en: enMessages.samples };

/**
 * A live preview of one language of a template, drawn by the same
 * `NotificationEmail` the sender uses, with sample values. The subject and
 * body go in as text: React escapes them, so a tag typed in a template shows
 * as text. The result is shown in a frame that runs no script and has no
 * access to the page.
 */
export function EmailPreview({
  event,
  locale,
  subject,
  body,
}: {
  event: EmailEvent;
  locale: Locale;
  subject: string;
  body: string;
}) {
  const t = useTranslations("DashboardEmailTemplates");
  const [html, setHtml] = useState<string | null>(null);
  const email = previewEmail(event, locale, { subject, body }, SAMPLES[locale]);
  const { subject: filledSubject, body: filledBody } = email;

  useEffect(() => {
    let current = true;
    const props = previewEmail(event, locale, { subject, body }, SAMPLES[locale]);
    void render(<NotificationEmail {...props} />)
      .then((markup) => {
        if (current) setHtml(markup);
      })
      .catch(() => {
        if (current) setHtml(null);
      });
    return () => {
      current = false;
    };
  }, [event, locale, subject, body]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{t("previewHeading")}</p>
      <p className="text-sm text-text-secondary">{t("previewHint")}</p>
      <p className="text-sm">
        <span className="font-semibold">{t("previewSubject")}</span>{" "}
        <bdi lang={locale} className="break-words">
          {filledSubject}
        </bdi>
      </p>
      {html === null ? (
        // Until the layout is drawn, and if it can't be: the same words, as text.
        <p
          lang={locale}
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="rounded-md border border-text/15 p-3 text-sm break-words whitespace-pre-wrap"
        >
          {filledBody}
        </p>
      ) : (
        <iframe
          title={t("previewTitle", { language: t(`locales.${locale}`) })}
          sandbox=""
          srcDoc={html}
          className="h-112 w-full rounded-md border border-text/15 bg-white"
        />
      )}
    </div>
  );
}
