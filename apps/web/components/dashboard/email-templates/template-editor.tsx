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
export function TemplateEditor({ entry }: { entry: EmailTemplateEntry }) {
  const t = useTranslations("DashboardEmailTemplates");
  const uiLocale = useLocale();
  const router = useRouter();
  const { event } = entry;
  const [values, setValues] = useState<TemplateValues>(() => toValues(entry));
  const [errors, setErrors] = useState<TemplateErrors>({});
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
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

  const set = (field: TemplateField, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

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
    if (!isChanged(values, entry)) {
      setMessage({ tone: "success", text: t("unchanged") });
      return;
    }
    setBusy("save");
    setMessage(null);
    const result = await saveTemplate({ event, ...values });
    setBusy(null);
    if (result.ok) router.refresh();
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
                <code dir="ltr" className="rounded bg-text/10 px-1.5 py-0.5 text-sm break-all">
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
        {entry.edited && !confirmingReset && (
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

      {entry.edited && confirmingReset && (
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
