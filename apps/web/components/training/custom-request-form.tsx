"use client";

import {
  customTrainingRequestSchema,
  errorResponseSchema,
  MAX_SHORT_TEXT_LENGTH,
  type CustomTrainingRequest,
} from "@repo/shared";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthState } from "@/components/clerk/auth-state";
import { Button, TextField } from "@/components/ui";
import { InlineNotice } from "@/components/account/notice";
import { CheckIcon } from "@/components/icons";

type Field = keyof CustomTrainingRequest;
type FieldErrors = Partial<Record<Field, string>>;

/** The fields in the order they appear, so focus goes to the first invalid one. */
const FIELD_ORDER: readonly Field[] = [
  "orgName",
  "topic",
  "traineeCount",
  "suggestedDate",
  "place",
  "contactEmail",
];

function value(form: FormData, name: Field) {
  const raw = form.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * The custom training request form (§6.7). No account needed. A signed-in
 * visitor's email is filled in for them, in the browser, so the page itself
 * never reads the session. Fields stay uncontrolled: what was typed stays in
 * place after an error. Sending shows a confirmation, never a promise about
 * when an answer comes.
 */
export function CustomRequestForm() {
  const t = useTranslations("Training.custom");
  // Clerk loads after the page (§13 Performance); the address arrives then.
  const { email } = useAuthState();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // A new key gives a fresh, empty form after "send another".
  const [formKey, setFormKey] = useState(0);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ownEmail = email ?? "";

  useEffect(() => {
    if (sent) sentHeading.current?.focus();
  }, [sent]);

  // Clerk loads after the page: fill the address in then, unless one was typed.
  useEffect(() => {
    const field = formRef.current?.querySelector<HTMLInputElement>('[name="contactEmail"]');
    if (field && ownEmail && field.value === "") field.value = ownEmail;
  }, [ownEmail, formKey, sent]);

  function check(form: FormData): { body?: CustomTrainingRequest; errors: FieldErrors } {
    const found: FieldErrors = {};
    for (const field of ["orgName", "topic"] as const) {
      const text = value(form, field);
      if (!text) found[field] = t("required");
      else if (text.length > MAX_SHORT_TEXT_LENGTH) {
        found[field] = t("tooLong", { max: MAX_SHORT_TEXT_LENGTH });
      }
    }
    const count = value(form, "traineeCount");
    if (!count) found.traineeCount = t("required");
    else if (!/^[0-9]+$/.test(count) || Number(count) < 1) found.traineeCount = t("countInvalid");
    const date = value(form, "suggestedDate");
    if (!date) found.suggestedDate = t("required");
    else if (!customTrainingRequestSchema.shape.suggestedDate.safeParse(date).success) {
      found.suggestedDate = t("dateInvalid");
    }
    const place = value(form, "place");
    if (place.length > MAX_SHORT_TEXT_LENGTH) {
      found.place = t("tooLong", { max: MAX_SHORT_TEXT_LENGTH });
    }
    const email = value(form, "contactEmail");
    if (!email) found.contactEmail = t("required");
    else if (!customTrainingRequestSchema.shape.contactEmail.safeParse(email).success) {
      found.contactEmail = t("emailInvalid");
    }

    const parsed = customTrainingRequestSchema.safeParse({
      orgName: value(form, "orgName"),
      traineeCount: Number(count),
      topic: value(form, "topic"),
      suggestedDate: date,
      // Optional: an empty place is left out, not sent as "".
      ...(place ? { place } : {}),
      contactEmail: email,
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
      const first = FIELD_ORDER.find((field) => found[field]);
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/training/custom-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setSent(true);
      } else {
        const parsed = errorResponseSchema.safeParse(await response.json().catch(() => null));
        setFormError(parsed.success ? parsed.data.error.message : t("failed"));
      }
    } catch {
      setFormError(t("networkError"));
    }
    setSending(false);
  }

  if (sent) {
    // The sent state on the raised ground, opened by the success rule; no promise of a reply time.
    return (
      <div role="status" className="flex flex-col gap-2 border-t-2 border-success bg-surface p-5">
        <h3 ref={sentHeading} tabIndex={-1} className="flex items-center gap-2 font-medium text-success type-small focus:outline-none">
          <CheckIcon aria-hidden="true" className="size-4" />
          {t("sentTitle")}
        </h3>
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

  // CustomTrainingRequest board: under the record's rule, the short fields in a pair, the rest across, in the order focus checks them.
  return (
    <form
      ref={formRef}
      key={formKey}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-x-6 gap-y-5.5 border-t-2 border-rule pt-5.5 sm:grid-cols-2"
    >
      {formError && <InlineNotice tone="danger" title={formError} className="sm:col-span-2" />}
      <TextField
        name="orgName"
        label={t("orgName")}
        autoComplete="organization"
        maxLength={MAX_SHORT_TEXT_LENGTH}
        required
        error={errors.orgName}
        className="sm:col-span-2"
      />
      <TextField
        name="topic"
        label={t("topic")}
        maxLength={MAX_SHORT_TEXT_LENGTH}
        required
        error={errors.topic}
        className="sm:col-span-2"
      />
      <TextField
        name="traineeCount"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        dir="ltr"
        label={t("traineeCount")}
        required
        error={errors.traineeCount}
      />
      <TextField
        name="suggestedDate"
        type="date"
        label={t("suggestedDate")}
        required
        error={errors.suggestedDate}
      />
      <TextField
        name="place"
        label={t("place")}
        hint={t("placeHint")}
        maxLength={MAX_SHORT_TEXT_LENGTH}
        error={errors.place}
        className="sm:col-span-2"
      />
      <TextField
        name="contactEmail"
        type="email"
        label={t("contactEmail")}
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        required
        error={errors.contactEmail}
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
