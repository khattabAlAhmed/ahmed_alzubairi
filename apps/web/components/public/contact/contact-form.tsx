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
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { InlineNotice } from "@/components/account/notice";
import { CheckIcon } from "@/components/icons";
import { Button, FieldError, Radio, TextArea, TextField } from "@/components/ui";
import { track } from "@/lib/analytics/track";

type Field = keyof ContactRequest;
type FieldErrors = Partial<Record<Field, string>>;

/** The fields in the order they appear, so focus goes to the first invalid one. */
const FIELD_ORDER: readonly Field[] = ["name", "email", "orgType", "subject", "message"];

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
  const orgTypeErrorId = useId();

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
      // From `found`, not the DOM: the new aria-invalid attributes aren't rendered yet.
      const first = FIELD_ORDER.find((field) => found[field]);
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
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
        // The category only: never the name, email, subject or message.
        track("contact_sent", { org_type: body.orgType });
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
    // ContactForm board: the sent state on the raised ground, opened by the
    // success rule. It thanks; it never promises when the reply comes.
    return (
      <div role="status" className="flex flex-col gap-2 border-t-2 border-success bg-surface p-5">
        <h2 ref={sentHeading} tabIndex={-1} className="flex items-center gap-2 font-medium text-success type-small focus:outline-none">
          <CheckIcon aria-hidden="true" className="size-4" />
          {t("sentTitle")}
        </h2>
        <p className="text-pretty type-small">{t("sentText")}</p>
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
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

  // ContactForm board: the page header introduces it, so no heading of its
  // own; the form keeps its accessible name.
  return (
    <form
      key={formKey}
      aria-label={t("formTitle")}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-x-6 gap-y-5.5 border-t-2 border-rule pt-5.5 sm:grid-cols-2"
    >
      {formError && <InlineNotice tone="danger" title={formError} className="sm:col-span-2" />}
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
        inputMode="email"
        dir="ltr"
        placeholder={t("emailPlaceholder")}
        required
        error={errors.email}
      />
      <fieldset
        aria-describedby={errors.orgType ? orgTypeErrorId : undefined}
        className="flex min-w-0 flex-col gap-2 sm:col-span-2"
      >
        <legend className="mb-2 text-sm font-medium">{t("orgType")}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {ORG_TYPES.map((type) => (
            <Radio key={type} name="orgType" value={type} label={t(`orgTypes.${type}`)} required />
          ))}
        </div>
        {errors.orgType && <FieldError id={orgTypeErrorId}>{errors.orgType}</FieldError>}
      </fieldset>
      <TextField
        name="subject"
        label={t("subject")}
        maxLength={MAX_SHORT_TEXT_LENGTH}
        required
        error={errors.subject}
        className="sm:col-span-2"
      />
      <TextArea
        name="message"
        label={t("message")}
        rows={7}
        maxLength={MAX_LONG_TEXT_LENGTH}
        required
        hint={t("messageHint")}
        error={errors.message}
        className="sm:col-span-2"
      />
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={sending} loadingLabel={t("sending")}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
