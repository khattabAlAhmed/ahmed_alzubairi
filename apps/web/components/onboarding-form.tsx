"use client";

import { useUser } from "@clerk/nextjs";
import {
  createProfileRequestSchema,
  errorResponseSchema,
  isIanaTimeZone,
  LOCALES,
  ORG_TYPES,
  type CreateProfileRequest,
  type Locale,
} from "@repo/shared";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/profile/phone";

const INPUT =
  "mt-1 block h-11 w-full rounded-md border border-text/20 bg-surface px-3 text-text focus:outline-2 focus:outline-offset-1 focus:outline-accent aria-[invalid=true]:border-red-600 dark:aria-[invalid=true]:border-red-400";
const LABEL = "block text-sm font-semibold";
const FIELD_ERROR = "mt-1 text-sm text-red-700 dark:text-red-300";
const LEGAL_LINK = "font-semibold underline underline-offset-2";

type FieldError = "name" | "phone" | "terms";

function browserTimeZone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isIanaTimeZone(zone) ? zone : "UTC";
}

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function OnboardingForm({
  destination,
  locale,
  askName,
}: {
  /** Already checked by `safeReturnPath` on the server. */
  destination: string;
  locale: Locale;
  /** Clerk has no name for this user yet. */
  askName: boolean;
}) {
  const t = useTranslations("Onboarding");
  const tErrors = useTranslations("Errors");
  const router = useRouter();
  const { user } = useUser();
  const id = useId();
  const [needsName, setNeedsName] = useState(askName);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = text(form, "firstName");
    const lastName = text(form, "lastName");
    const phone = normalizePhone(text(form, "phone") ?? "");
    const termsAccepted = form.get("terms") === "on";

    const errors: FieldError[] = [];
    if (needsName && (!firstName || !lastName)) errors.push("name");
    if (!createProfileRequestSchema.shape.phone.safeParse(phone).success) {
      errors.push("phone");
    }
    if (!termsAccepted) errors.push("terms");
    setFieldErrors(errors);
    setFormError(null);
    if (errors.length > 0) return;

    const body: CreateProfileRequest = {
      phone,
      termsAccepted: true,
      timezone: browserTimeZone(),
      orgType: ORG_TYPES.find((item) => item === form.get("orgType")),
      orgName: text(form, "orgName"),
      jobTitle: text(form, "jobTitle"),
      locale: LOCALES.find((item) => item === form.get("locale")),
    };

    setSaving(true);
    try {
      // The server reads the name from Clerk only, so it is saved there first.
      if (needsName) {
        if (!user) throw new Error("Clerk user not loaded");
        await user.update({ firstName, lastName });
      }
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      // A conflict means the profile already exists, so there is nothing left to do.
      if (response.ok || response.status === 409) {
        router.replace(destination);
        return;
      }
      const parsed = errorResponseSchema.safeParse(await response.json());
      if (parsed.success && parsed.data.error.code === "profile_incomplete") {
        setNeedsName(true);
        setFieldErrors(["name"]);
      }
      setFormError(
        parsed.success ? parsed.data.error.message : tErrors("internal_error"),
      );
    } catch {
      setFormError(t("networkError"));
    }
    setSaving(false);
  }

  const invalid = (field: FieldError) => fieldErrors.includes(field);
  const errorId = (field: FieldError) => `${id}-${field}-error`;
  const describedBy = (field: FieldError, hint?: string) =>
    [hint, invalid(field) ? errorId(field) : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  const optional = (label: string) => (
    <>
      {label} <span className="font-normal text-text-secondary">{t("optional")}</span>
    </>
  );
  const fieldError = (field: FieldError, message: string) =>
    invalid(field) ? (
      <p id={errorId(field)} className={FIELD_ERROR}>
        {message}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-red-600/40 bg-red-600/10 p-3 text-sm dark:border-red-400/40"
        >
          {formError}
        </p>
      ) : null}

      {needsName ? (
        <fieldset>
          <legend className={LABEL}>{t("nameLegend")}</legend>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              {t("firstName")}
              <input
                name="firstName"
                autoComplete="given-name"
                required
                aria-invalid={invalid("name")}
                aria-describedby={describedBy("name")}
                className={INPUT}
              />
            </label>
            <label className="block text-sm">
              {t("lastName")}
              <input
                name="lastName"
                autoComplete="family-name"
                required
                aria-invalid={invalid("name")}
                aria-describedby={describedBy("name")}
                className={INPUT}
              />
            </label>
          </div>
          {fieldError("name", t("nameRequired"))}
        </fieldset>
      ) : null}

      <div>
        <label htmlFor={`${id}-phone`} className={LABEL}>
          {t("phone")}
        </label>
        <input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          aria-invalid={invalid("phone")}
          aria-describedby={describedBy("phone", `${id}-phone-hint`)}
          className={`${INPUT} text-start`}
        />
        <p id={`${id}-phone-hint`} className="mt-1 text-sm text-text-secondary">
          {t("phoneHint")}
        </p>
        {fieldError("phone", t("phoneInvalid"))}
      </div>

      <div>
        <label htmlFor={`${id}-orgType`} className={LABEL}>
          {optional(t("orgType"))}
        </label>
        <select id={`${id}-orgType`} name="orgType" defaultValue="" className={INPUT}>
          <option value="">{t("orgTypeNone")}</option>
          {ORG_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`orgTypes.${type}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-orgName`} className={LABEL}>
          {optional(t("orgName"))}
        </label>
        <input
          id={`${id}-orgName`}
          name="orgName"
          autoComplete="organization"
          maxLength={200}
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor={`${id}-jobTitle`} className={LABEL}>
          {optional(t("jobTitle"))}
        </label>
        <input
          id={`${id}-jobTitle`}
          name="jobTitle"
          autoComplete="organization-title"
          maxLength={200}
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor={`${id}-locale`} className={LABEL}>
          {optional(t("locale"))}
        </label>
        <select id={`${id}-locale`} name="locale" defaultValue={locale} className={INPUT}>
          {LOCALES.map((item) => (
            <option key={item} value={item} lang={item}>
              {t(`locales.${item}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="terms"
            required
            aria-invalid={invalid("terms")}
            aria-describedby={describedBy("terms")}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span>
            {t.rich("terms", {
              privacy: (chunks: ReactNode) => (
                <Link href="/privacy" target="_blank" className={LEGAL_LINK}>
                  {chunks}
                </Link>
              ),
              terms: (chunks: ReactNode) => (
                <Link href="/terms" target="_blank" className={LEGAL_LINK}>
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {fieldError("terms", t("termsRequired"))}
      </div>

      <button
        type="submit"
        disabled={saving}
        aria-busy={saving}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 font-semibold text-on-accent shadow-sm hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {saving ? t("saving") : t("submit")}
      </button>
    </form>
  );
}
