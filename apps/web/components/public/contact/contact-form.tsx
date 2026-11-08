"use client";

import {
  contactRequestSchema,
  errorResponseSchema,
  MAX_LONG_TEXT_LENGTH,
  MAX_SHORT_TEXT_LENGTH,
  ORG_TYPES,
  type ContactRequest,
} from "@repo/shared";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Select, TextArea, TextField } from "@/components/ui";

type Field = keyof ContactRequest;
type FieldErrors = Partial<Record<Field, string>>;

function value(form: FormData, name: Field) {
  const raw = form.get(name);
  return typeof raw === "string" ? raw : "";
}

/**
 * The contact form (§6.14). Fields stay uncontrolled, so whatever the visitor
 * typed stays in place after an error. Sending shows a confirmation, never a
 * promise about when Ahmed will answer.
 */
export function ContactForm() {
  const t = useTranslations("Contact");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // A new key gives a fresh, empty form after "send another".
  const [formKey, setFormKey] = useState(0);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (sent) sentHeading.current?.focus();
  }, [sent]);

  function check(form: FormData): { body?: ContactRequest; errors: FieldErrors } {
    const found: FieldErrors = {};
    const text = (field: "name" | "subject" | "message", max: number) => {
      const trimmed = value(form, field).trim();
      if (!trimmed) found[field] = t("required");
      else if (trimmed.length > max) found[field] = t("tooLong", { max });
    };
    text("name", MAX_SHORT_TEXT_LENGTH);
    text("subject", MAX_SHORT_TEXT_LENGTH);
    text("message", MAX_LONG_TEXT_LENGTH);
    const email = value(form, "email").trim();
    if (!email) found.email = t("required");
    else if (!contactRequestSchema.shape.email.safeParse(email).success) found.email = t("emailInvalid");
    if (!ORG_TYPES.some((type) => type === value(form, "orgType"))) found.orgType = t("orgTypeRequired");

    const parsed = contactRequestSchema.safeParse({
      name: value(form, "name"),
      email,
      orgType: value(form, "orgType"),
      subject: value(form, "subject"),
      message: value(form, "message"),
    });
    return { body: parsed.success ? parsed.data : undefined, errors: found };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter in a field submits too, so a second send is blocked here as well.
    if (sending) return;
    const form = event.currentTarget;
    const { body, errors: found } = check(new FormData(form));
    setErrors(found);
    setFormError(null);
    if (!body || Object.keys(found).length > 0) {
      form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setSent(true);
      } else {
        const parsed = errorResponseSchema.safeParse(await response.json().catch(() => null));
        setFormError(parsed.success ? parsed.data.error.message : t("errors.internal_error"));
      }
    } catch {
      setFormError(t("networkError"));
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div role="status" className="rounded-lg border border-text/15 bg-surface p-6 shadow-sm">
        <h2 ref={sentHeading} tabIndex={-1} className="text-2xl focus:outline-none">
          {t("sentTitle")}
        </h2>
        <p className="mt-2 text-text-secondary">{t("sentText")}</p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setSent(false);
            setErrors({});
            setFormKey((key) => key + 1);
          }}
        >
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="contact-form-title">
      <h2 id="contact-form-title" className="text-2xl">
        {t("formTitle")}
      </h2>
      <p className="mt-2 text-text-secondary">{t("noAccount")}</p>
      <form key={formKey} onSubmit={onSubmit} noValidate className="mt-6 grid gap-5">
        {formError && (
          <p role="alert" className="rounded-md border-2 border-danger p-3 text-sm font-semibold text-danger">
            {formError}
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="name"
            label={t("name")}
            autoComplete="name"
            maxLength={MAX_SHORT_TEXT_LENGTH}
            required
            error={errors.name}
          />
          <TextField
            name="email"
            type="email"
            label={t("emailField")}
            autoComplete="email"
            dir="ltr"
            required
            error={errors.email}
          />
        </div>
        <Select name="orgType" label={t("orgType")} defaultValue="" required error={errors.orgType}>
          <option value="" disabled>
            {t("orgTypeChoose")}
          </option>
          {ORG_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`orgTypes.${type}`)}
            </option>
          ))}
        </Select>
        <TextField
          name="subject"
          label={t("subject")}
          maxLength={MAX_SHORT_TEXT_LENGTH}
          required
          error={errors.subject}
        />
        <TextArea
          name="message"
          label={t("message")}
          rows={7}
          maxLength={MAX_LONG_TEXT_LENGTH}
          required
          error={errors.message}
        />
        <div>
          <Button type="submit" size="lg" loading={sending} loadingLabel={t("sending")}>
            {t("send")}
          </Button>
        </div>
      </form>
    </section>
  );
}
