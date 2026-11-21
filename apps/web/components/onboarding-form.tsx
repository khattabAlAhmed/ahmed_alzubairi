"use client";

import { useAuth, useUser } from "@clerk/nextjs";
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
import { InlineNotice } from "@/components/account/notice";
import { Button, Checkbox, FieldError, FieldHint, INLINE_LINK, Select, TextField } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/profile/phone";
import { track } from "@/lib/analytics/track";

/** Inside the consent label, in the page's link style. */
const LEGAL_LINK = INLINE_LINK;

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
  const { getToken } = useAuth();
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
      // The session cookie lasts a minute. A tab left in the background may not
      // have refreshed it, and the server would answer 401; this refreshes it.
      await getToken();
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      // A conflict means the profile already exists, so there is nothing left to do.
      if (response.ok || response.status === 409) {
        // 409: the profile already existed, so this isn't a new sign-up.
        if (response.ok) track("signed_up");
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

  // Onboarding board: the fields in pairs under the record's rule, optional
  // ones marked in words, the phone read left to right, consent last.
  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-5 border-t-2 border-rule pt-5">
      {formError ? <InlineNotice tone="danger" title={formError} /> : null}

      {needsName ? (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-[15px] leading-[1.6] font-medium">{t("nameLegend")}</legend>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <TextField
              name="firstName"
              label={t("firstName")}
              autoComplete="given-name"
              required
              aria-invalid={invalid("name") || undefined}
              aria-describedby={invalid("name") ? errorId("name") : undefined}
            />
            <TextField
              name="lastName"
              label={t("lastName")}
              autoComplete="family-name"
              required
              aria-invalid={invalid("name") || undefined}
              aria-describedby={invalid("name") ? errorId("name") : undefined}
            />
          </div>
          {invalid("name") && <FieldError id={errorId("name")}>{t("nameRequired")}</FieldError>}
        </fieldset>
      ) : null}

      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        {/* The hint holds a number that must read LTR, so it's rich text beside the field. */}
        <div className="flex min-w-0 flex-col gap-2">
          <TextField
            id={`${id}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            required
            label={t("phone")}
            error={invalid("phone") ? t("phoneInvalid") : undefined}
            aria-describedby={[`${id}-phone-hint`, invalid("phone") && `${id}-phone-error`].filter(Boolean).join(" ")}
          />
          <FieldHint id={`${id}-phone-hint`}>
            {t.rich("phoneHint", {
              number: (chunks: ReactNode) => <bdi dir="ltr">{chunks}</bdi>,
            })}
          </FieldHint>
        </div>
        <Select id={`${id}-orgType`} name="orgType" defaultValue="" label={t("orgType")} mark={t("optional")}>
          <option value="">{t("orgTypeNone")}</option>
          {ORG_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`orgTypes.${type}`)}
            </option>
          ))}
        </Select>
        <TextField
          id={`${id}-orgName`}
          name="orgName"
          autoComplete="organization"
          maxLength={200}
          label={t("orgName")}
          mark={t("optional")}
        />
        <TextField
          id={`${id}-jobTitle`}
          name="jobTitle"
          autoComplete="organization-title"
          maxLength={200}
          label={t("jobTitle")}
          mark={t("optional")}
        />
        <Select id={`${id}-locale`} name="locale" defaultValue={locale} label={t("locale")} mark={t("optional")}>
          {LOCALES.map((item) => (
            <option key={item} value={item} lang={item}>
              {t(`locales.${item}`)}
            </option>
          ))}
        </Select>
      </div>

      <Checkbox
        name="terms"
        required
        label={t.rich("terms", {
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
        error={invalid("terms") ? t("termsRequired") : undefined}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={saving} loadingLabel={t("saving")} className="w-full sm:w-auto">
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
