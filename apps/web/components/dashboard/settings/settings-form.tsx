"use client";

import { MAX_SOCIAL_LINKS, type SiteSettings } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button, Card, Checkbox, TextField } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { acceptFor, mediaUrl, uploadFile, UploadError } from "../content/upload";
import {
  buildChanges,
  saveSettings,
  toValues,
  type SettingsErrors,
  type SettingsValues,
} from "./form";

type Message = { tone: "success" | "error"; text: string };

/** The CV file: what's saved, and an upload to the `media` target. */
function CvUpload({
  fileKey,
  mediaBase,
  onUploaded,
}: {
  fileKey: string;
  mediaBase: string;
  onUploaded: (key: string) => void;
}) {
  const t = useTranslations("DashboardTrust.settings");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadFile(file, "media"));
    } catch (failure) {
      setError(
        failure instanceof UploadError && failure.serverMessage
          ? failure.serverMessage
          : t("uploadFailed"),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-sm font-semibold">
        {t("cvFile")}
      </p>
      <p id={`${id}-hint`} className="mt-1 text-sm text-text-secondary">
        {t("cvFileHint")}
      </p>
      {fileKey ? (
        <p className="mt-2 text-sm">
          {t("cvAttached")}{" "}
          <a
            href={mediaUrl(mediaBase, fileKey)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-4"
          >
            {t("cvOpen")}
          </a>
        </p>
      ) : (
        <p className="mt-2 text-sm">{t("cvNone")}</p>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={acceptFor("media", false)}
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
      <Button
        variant="secondary"
        size="sm"
        className="mt-2"
        loading={busy}
        loadingLabel={t("uploading")}
        aria-describedby={`${id}-hint`}
        onClick={() => input.current?.click()}
      >
        {busy ? t("uploading") : fileKey ? t("cvReplace") : t("cvChoose")}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Contact channels, social links and the CV (§6.20 Settings). Saves only
 * what changed, one key per request, through `PATCH /api/admin/settings`.
 */
export function SettingsForm({ saved, mediaBase }: { saved: SiteSettings; mediaBase: string }) {
  const t = useTranslations("DashboardTrust.settings");
  const router = useRouter();
  const [values, setValues] = useState<SettingsValues>(() => toValues(saved));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const contactId = useId();
  const socialId = useId();
  const cvId = useId();

  const set = <K extends keyof SettingsValues>(name: K, value: SettingsValues[K]) =>
    setValues((current) => ({ ...current, [name]: value }));

  const errorText = (name: string) => {
    const code = errors[name];
    return code ? t(`errors.${code}`, { max: MAX_SOCIAL_LINKS }) : undefined;
  };

  const setLink = (index: number, side: "platform" | "url", value: string) =>
    set(
      "socialLinks",
      values.socialLinks.map((link, i) => (i === index ? { ...link, [side]: value } : link)),
    );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const built = buildChanges(values, saved);
    setErrors(built.errors);
    if (Object.keys(built.errors).length > 0) {
      setMessage({ tone: "error", text: t("fixErrors") });
      return;
    }
    if (built.changes.length === 0) {
      setMessage({ tone: "success", text: t("unchanged") });
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await saveSettings(built.changes);
    setSaving(false);
    // Reload what was saved, even after a failure part-way.
    router.refresh();
    setMessage(
      result.ok
        ? { tone: "success", text: t("saved") }
        : { tone: "error", text: result.message ?? t("failed") },
    );
  }

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <Card as="section" compact aria-labelledby={contactId} className="space-y-4">
        <h2 id={contactId} className="text-lg">
          {t("contactHeading")}
        </h2>
        <TextField
          name="contactEmail"
          type="email"
          dir="ltr"
          autoComplete="off"
          label={t("contactEmail")}
          error={errorText("contactEmail")}
          value={values.contactEmail}
          onChange={(event) => set("contactEmail", event.target.value)}
        />
        <TextField
          name="whatsappNumber"
          type="tel"
          dir="ltr"
          inputMode="tel"
          label={t("whatsappNumber")}
          hint={t("whatsappHint")}
          error={errorText("whatsappNumber")}
          value={values.whatsappNumber}
          onChange={(event) => set("whatsappNumber", event.target.value)}
        />
        <TextField
          name="linkedinUrl"
          type="url"
          dir="ltr"
          label={t("linkedinUrl")}
          hint={t("linkedinHint")}
          error={errorText("linkedinUrl")}
          value={values.linkedinUrl}
          onChange={(event) => set("linkedinUrl", event.target.value)}
        />
      </Card>

      <Card as="section" compact aria-labelledby={socialId} className="space-y-4">
        <div>
          <h2 id={socialId} className="text-lg">
            {t("socialHeading")}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t("socialHint", { max: MAX_SOCIAL_LINKS })}
          </p>
        </div>
        {values.socialLinks.length > 0 && (
          <ul className="space-y-4">
            {values.socialLinks.map((link, index) => (
              <li
                // Rows have no id; the index is their identity while editing.
                key={index}
                className="grid gap-3 rounded-md border border-text/10 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-start"
              >
                <TextField
                  label={t("platformNumber", { number: index + 1 })}
                  error={errorText(`social.${index}.platform`)}
                  value={link.platform}
                  onChange={(event) => setLink(index, "platform", event.target.value)}
                />
                <TextField
                  type="url"
                  dir="ltr"
                  label={t("urlNumber", { number: index + 1 })}
                  error={errorText(`social.${index}.url`)}
                  value={link.url}
                  onChange={(event) => setLink(index, "url", event.target.value)}
                />
                <Button
                  variant="quiet"
                  size="sm"
                  className="sm:mt-7"
                  onClick={() =>
                    set(
                      "socialLinks",
                      values.socialLinks.filter((_, i) => i !== index),
                    )
                  }
                >
                  {t("removeLink", { number: index + 1 })}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {errors.socialLinks && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {errorText("socialLinks")}
          </p>
        )}
        {values.socialLinks.length < MAX_SOCIAL_LINKS && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => set("socialLinks", [...values.socialLinks, { platform: "", url: "" }])}
          >
            {t("addLink")}
          </Button>
        )}
      </Card>

      <Card as="section" compact aria-labelledby={cvId} className="space-y-4">
        <h2 id={cvId} className="text-lg">
          {t("cvHeading")}
        </h2>
        <CvUpload
          fileKey={values.cvFileKey}
          mediaBase={mediaBase}
          onUploaded={(key) => set("cvFileKey", key)}
        />
        <Checkbox
          name="cvVisible"
          label={t("cvVisible")}
          hint={t("cvVisibleHint")}
          error={errorText("cvVisible")}
          checked={values.cvVisible}
          onChange={(event) => set("cvVisible", event.target.checked)}
        />
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" loading={saving} loadingLabel={t("saving")}>
          {saving ? t("saving") : t("save")}
        </Button>
        <div aria-live="polite" className="min-w-0 flex-1">
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
    </form>
  );
}
