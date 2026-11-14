"use client";

import {
  isIanaTimeZone,
  MAX_PROFILE_TEXT_LENGTH,
  ORG_TYPES,
  updateProfileRequestSchema,
  type OrgType,
  type UpdateProfileRequest,
} from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, Card, Select, TextField } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/profile/phone";
import { NoticeLine, type Notice } from "./notice";
import { saveProfile } from "./send";

export type DetailsValues = {
  phone: string;
  orgType: OrgType | null;
  orgName: string | null;
  jobTitle: string | null;
  timezone: string;
};

type Errors = Partial<Record<"phone" | "orgName" | "jobTitle", string>>;

/** Every IANA zone the browser knows, with the saved one first if it's missing. */
export function timeZones(saved: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return all.includes(saved) ? all : [saved, ...all];
}

/**
 * The fields that differ from what's saved, as the `PATCH` body. An emptied
 * text field that was saved can't be sent: the contract has no way to clear
 * it, so it comes back as an error instead.
 */
export function changedFields(
  saved: DetailsValues,
  values: DetailsValues,
): { body: UpdateProfileRequest; emptied: ("orgName" | "jobTitle")[] } {
  const body: UpdateProfileRequest = {};
  const emptied: ("orgName" | "jobTitle")[] = [];
  const phone = normalizePhone(values.phone.trim());
  if (phone !== saved.phone) body.phone = phone;
  if (values.orgType && values.orgType !== saved.orgType) body.orgType = values.orgType;
  for (const key of ["orgName", "jobTitle"] as const) {
    const next = values[key]?.trim() ?? "";
    if (next === (saved[key] ?? "")) continue;
    if (next === "") emptied.push(key);
    else body[key] = next;
  }
  if (values.timezone !== saved.timezone) body.timezone = values.timezone;
  return { body, emptied };
}

/** Phone, organization, job title and time zone. Name and email stay with Clerk. */
export function DetailsForm({
  saved,
  fullName,
  email,
}: {
  saved: DetailsValues;
  fullName: string;
  email: string;
}) {
  const t = useTranslations("AccountProfile");
  const router = useRouter();
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const zones = timeZones(saved.timezone);
  const set = <K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const { body, emptied } = changedFields(saved, values);
    const found: Errors = {};
    for (const key of emptied) found[key] = t("details.cantEmpty");
    if (body.phone !== undefined && !updateProfileRequestSchema.safeParse({ phone: body.phone }).success) {
      found.phone = t("details.phoneInvalid");
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (Object.keys(body).length === 0) {
      setNotice({ ok: true, text: t("details.nothing") });
      return;
    }

    setBusy(true);
    const result = await saveProfile(body);
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("details.failed") });
      return;
    }
    setNotice({ ok: true, text: t("details.saved") });
    router.refresh();
  }

  function pickDeviceZone() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isIanaTimeZone(zone)) set("timezone", zone);
  }

  return (
    <Card as="section" aria-labelledby="details-title" className="space-y-4">
      <div>
        <h2 id="details-title" className="text-xl">
          {t("details.title")}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{t("details.identity")}</p>
      </div>
      {/* Name and email are text, never HTML (§9). */}
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-sm text-text-secondary">{t("details.name")}</dt>
          <dd className="font-semibold break-words">
            <bdi>{fullName}</bdi>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-text-secondary">{t("details.email")}</dt>
          <dd className="font-semibold wrap-anywhere">
            <bdi dir="ltr">{email}</bdi>
          </dd>
        </div>
      </dl>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("details.phone")}
            hint={t("details.phoneHint")}
            type="tel"
            dir="ltr"
            autoComplete="tel"
            value={values.phone}
            maxLength={30}
            onChange={(event) => set("phone", event.target.value)}
            error={errors.phone}
          />
          <Select
            label={t("details.orgType")}
            value={values.orgType ?? ""}
            onChange={(event) => set("orgType", (event.target.value || null) as OrgType | null)}
          >
            {/* "Not given" only while nothing is saved: the contract can't clear it. */}
            {!saved.orgType && <option value="">{t("details.orgTypeNone")}</option>}
            {ORG_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`orgTypes.${type}`)}
              </option>
            ))}
          </Select>
          <TextField
            label={t("details.orgName")}
            autoComplete="organization"
            value={values.orgName ?? ""}
            maxLength={MAX_PROFILE_TEXT_LENGTH}
            onChange={(event) => set("orgName", event.target.value)}
            error={errors.orgName}
          />
          <TextField
            label={t("details.jobTitle")}
            autoComplete="organization-title"
            value={values.jobTitle ?? ""}
            maxLength={MAX_PROFILE_TEXT_LENGTH}
            onChange={(event) => set("jobTitle", event.target.value)}
            error={errors.jobTitle}
          />
        </div>
        {/* The button lines up with the field, not with its hint: mt-6 is the label's height. */}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <Select
            label={t("details.timezone")}
            hint={t("details.timezoneHint")}
            value={values.timezone}
            onChange={(event) => set("timezone", event.target.value)}
            className="min-w-0 flex-1 basis-64"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
          <Button type="button" variant="quiet" onClick={pickDeviceZone} className="-ms-4 sm:ms-0 sm:mt-6">
            {t("details.useDevice")}
          </Button>
        </div>
        <Button type="submit" loading={busy} loadingLabel={t("details.saving")}>
          {t("details.save")}
        </Button>
        <NoticeLine notice={notice} />
      </form>
    </Card>
  );
}
