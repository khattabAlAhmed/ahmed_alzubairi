"use client";

import { EMAIL_PLACEHOLDERS, type Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button, LanguageTabs, TextArea, TextField } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import {
  defaultTemplate,
  placeholderToken,
  type EmailTemplateEntry,
  type TemplateField,
} from "@/lib/admin/email-templates/templates";
import { EmailPreview } from "./email-preview";
import {
  isChanged,
  resetTemplate,
  saveTemplate,
  toValues,
  validateTemplate,
  type TemplateErrors,
  type TemplateValues,
} from "./form";

type PlaceholderKey =
  `placeholders.${keyof MessageNamespaces["DashboardEmailTemplates"]["placeholders"]}`;

type Message = { tone: "success" | "error"; text: string };

const FIELDS: Record<Locale, { subject: TemplateField; body: TemplateField }> = {
  ar: { subject: "subjectAr", body: "bodyAr" },
  en: { subject: "subjectEn", body: "bodyEn" },
};

/**
 * The editor of one email (§6.21): its subject and body in Arabic and
 * English as plain text, the placeholders the event allows, and a live
 * preview of each language. Saves through `PATCH /api/admin/email-templates`;
 * "Reset to default" deletes the saved template after a second step.
 */
export function TemplateEditor({
  entry,
  onBusyChange,
}: {
  entry: EmailTemplateEntry;
  /**
   * Told when a save or a reset starts and ends, so the list keeps this
   * editor open until the request settles: a closed and reopened editor
   * could otherwise send a second save that lands before the first.
   */
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useTranslations("DashboardEmailTemplates");
  const uiLocale = useLocale();
  const router = useRouter();
  const { event } = entry;
  const [values, setValues] = useState<TemplateValues>(() => toValues(entry));
  const [errors, setErrors] = useState<TemplateErrors>({});
  // What the server holds, as far as this editor knows. It is updated as soon
  // as a save or a reset succeeds, without waiting for the page to be read
  // again, so the next submission is compared with the right text.
  const [saved, setSaved] = useState<EmailTemplateEntry>(entry);
  const [busy, setBusyState] = useState<"save" | "reset" | null>(null);
  const setBusy = (next: "save" | "reset" | null) => {
    setBusyState(next);
    onBusyChange?.(next !== null);
  };
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const placeholdersId = useId();
  const resetId = useId();
  const separator = uiLocale === "ar" ? "، " : ", ";

  const errorText = (field: TemplateField) => {
    const error = errors[field];
    if (!error) return undefined;
    if (error.code === "tooLong") return t("errors.tooLong", { max: error.max });
    if (error.code === "unknownPlaceholder") {
      return t("errors.unknownPlaceholder", {
        names: error.names.map(placeholderToken).join(separator),
      });
    }
    return t("errors.required");
  };

  /** What a placeholder stands for, or nothing for one added without a description. */
  const describe = (name: string) => {
    const key = `placeholders.${name}` as PlaceholderKey;
    return t.has(key) ? t(key) : null;
  };

  const set = (field: TemplateField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // The field is being corrected: its error and the notice about it go.
    setErrors((current) => {
      if (!(field in current)) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });
    setMessage((current) => (current?.tone === "error" ? null : current));
  };

  async function onSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    if (busy) return;
    setConfirmingReset(false);
    const found = validateTemplate(event, values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage({ tone: "error", text: t("fixErrors") });
      return;
    }
    if (!isChanged(values, saved)) {
      setMessage({ tone: "success", text: t("unchanged") });
      return;
    }
    setBusy("save");
    setMessage(null);
    const sent = { event, ...values };
    const result = await saveTemplate(sent);
    setBusy(null);
    if (result.ok) {
      // The route trims each text before it stores it.
      setSaved({
        event,
        subjectAr: sent.subjectAr.trim(),
        subjectEn: sent.subjectEn.trim(),
        bodyAr: sent.bodyAr.trim(),
        bodyEn: sent.bodyEn.trim(),
        edited: true,
      });
      router.refresh();
    }
    setMessage(
      result.ok
        ? { tone: "success", text: t("saved") }
        : { tone: "error", text: result.message ?? t("failed") },
    );
  }

  async function onReset() {
    if (busy) return;
    setBusy("reset");
    setMessage(null);
    const result = await resetTemplate(event);
    setBusy(null);
    setConfirmingReset(false);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message ?? t("resetFailed") });
      return;
    }
    setSaved({ ...defaultTemplate(event), edited: false });
    setValues(toValues(defaultTemplate(event)));
    setErrors({});
    setMessage({ tone: "success", text: t("resetDone") });
    router.refresh();
  }

  const panel = (locale: Locale) => {
    const { subject, body } = FIELDS[locale];
    return {
      label: t(`locales.${locale}`),
      invalid: Boolean(errors[subject] ?? errors[body]),
      content: (
        <>
          <TextField
            name={subject}
            label={t("subject")}
            hint={t("subjectHint")}
            error={errorText(subject)}
            value={values[subject]}
            onChange={(change) => set(subject, change.target.value)}
          />
          <TextArea
            name={body}
            rows={10}
            label={t("body")}
            hint={t("bodyHint")}
            error={errorText(body)}
            value={values[body]}
            onChange={(change) => set(body, change.target.value)}
          />
          <EmailPreview
            event={event}
            locale={locale}
            subject={values[subject]}
            body={values[body]}
          />
        </>
      ),
    };
  };

  return (
    <form noValidate onSubmit={(submitEvent) => void onSubmit(submitEvent)} className="space-y-6">
      <section aria-labelledby={placeholdersId} className="space-y-2">
        <h4 id={placeholdersId} className="text-base font-semibold">
          {t("placeholdersHeading")}
        </h4>
        <p className="text-sm text-text-secondary">{t("placeholdersHint")}</p>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          {EMAIL_PLACEHOLDERS[event].map((name) => (
            <div key={name} className="contents">
              <dt>
                <code dir="ltr" className="rounded bg-text/10 px-1.5 py-0.5 text-sm wrap-anywhere">
                  {placeholderToken(name)}
                </code>
              </dt>
              <dd className="text-sm text-text-secondary">
                {describe(name)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <LanguageTabs
        label={t("languageTabs")}
        invalidLabel={t("invalidTab")}
        arabic={panel("ar")}
        english={panel("en")}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button type="submit" loading={busy === "save"} loadingLabel={t("saving")}>
          {busy === "save" ? t("saving") : t("save")}
        </Button>
        {saved.edited && !confirmingReset && (
          <Button variant="secondary" onClick={() => setConfirmingReset(true)}>
            {t("reset")}
          </Button>
        )}
        <div aria-live="polite" className="min-w-0 flex-1 basis-48">
          {message && (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={
                message.tone === "error"
                  ? "text-sm font-semibold text-danger"
                  : "text-sm font-semibold"
              }
            >
              {message.text}
            </p>
          )}
        </div>
      </div>

      {saved.edited && confirmingReset && (
        <div
          role="group"
          aria-labelledby={resetId}
          className="space-y-3 rounded-md border border-danger p-4"
        >
          <p id={resetId} className="text-sm font-semibold">
            {t("resetQuestion")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "reset"}
              loadingLabel={t("resetting")}
              onClick={() => void onReset()}
            >
              {busy === "reset" ? t("resetting") : t("resetYes")}
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirmingReset(false)}>
              {t("resetNo")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
