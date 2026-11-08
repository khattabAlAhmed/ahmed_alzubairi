"use client";

import { LOCALES, type Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button, Card, Checkbox, LanguageTabs } from "@/components/ui";
import { EditorActions, PublishPanel, useContentEditor } from "../content/content-editor";
import { FieldInput } from "../content/field-input";
import { useFieldText, type RefOption } from "../content/field-text";
import { inputNames, type Row } from "../content/form-values";
import { CONTENT_CONFIG, type FieldDef } from "../content/registry";
import { acceptFor, uploadFile, UploadError } from "../content/upload";
import type { TrustType } from "./rows";

function isLocalized(field: FieldDef): boolean {
  return "localized" in field && field.localized;
}

/** Fields this editor draws itself, outside the generic inputs. */
const OWN_FIELDS = new Set(["consentConfirmed", "letterKey"]);

/**
 * The source letter: whether one is attached, and an upload to the private
 * `letter` target. The key goes in the form and is saved with it; the path is
 * never shown.
 */
function LetterUpload({
  attached,
  onUploaded,
}: {
  attached: boolean;
  onUploaded: (key: string) => void;
}) {
  const t = useTranslations("DashboardTrust.letter");
  const text = useFieldText();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadFile(file, "letter"));
    } catch (failure) {
      setError(
        failure instanceof UploadError && failure.serverMessage
          ? failure.serverMessage
          : text.t("upload.failed"),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-sm font-semibold">
        {t("heading")}
      </p>
      <p id={`${id}-hint`} className="mt-1 text-sm text-text-secondary">
        {t("hint")} {text.t("upload.fileHint")}
      </p>
      <p className="mt-2 text-sm">{attached ? t("attached") : t("none")}</p>
      <input
        ref={input}
        type="file"
        hidden
        accept={acceptFor("letter", false)}
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
      <Button
        variant="secondary"
        size="sm"
        className="mt-2"
        loading={busy}
        loadingLabel={text.t("upload.uploading")}
        aria-describedby={`${id}-hint`}
        onClick={() => input.current?.click()}
      >
        {busy ? text.t("upload.uploading") : attached ? text.t("upload.replace") : text.t("upload.choose")}
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
 * The form for one testimonial or logo, on the shared editor state: the
 * text in both languages, the partner, the logo or letter, the consent
 * checkbox "تمت الموافقة على النشر", and the shared publish panel, which
 * blocks publishing until consent and approval are both set and says why.
 */
export function TrustEditor({
  type,
  row,
  hasLetter,
  partnerOptions,
  mediaBase,
}: {
  type: TrustType;
  row: Row;
  hasLetter: boolean;
  partnerOptions: RefOption[];
  mediaBase: string;
}) {
  const text = useFieldText();
  const t = useTranslations("DashboardTrust");
  const editor = useContentEditor({
    type,
    row,
    refOptions: { partners: partnerOptions },
    mediaBase,
  });
  const { ctx, errors } = editor;
  const fields = CONTENT_CONFIG[type].fields;
  const localized = fields.filter(isLocalized);
  const others = fields.filter((field) => !isLocalized(field) && !OWN_FIELDS.has(field.name));
  const headingId = useId();

  const panel = (locale: Locale) => {
    const index = LOCALES.indexOf(locale);
    return {
      label: text.t(`locales.${locale}`),
      invalid: localized.some((field) => inputNames(field)[index] in errors),
      content: localized.map((field) => {
        const name = inputNames(field)[index];
        return <FieldInput key={name} field={field} name={name} ctx={ctx} />;
      }),
    };
  };

  const newLetter = typeof ctx.values.letterKey === "string" && ctx.values.letterKey !== "";

  return (
    <form noValidate onSubmit={(event) => void editor.save(event)} className="mt-4 space-y-6">
      <LanguageTabs
        label={text.t("editor.languageTabs")}
        invalidLabel={text.t("editor.invalidTab")}
        arabic={panel("ar")}
        english={panel("en")}
      />
      <Card as="section" compact aria-labelledby={headingId} className="space-y-4">
        <h4 id={headingId} className="text-lg">
          {text.t("editor.otherFields")}
        </h4>
        {others.map((field) => (
          <FieldInput key={field.name} field={field} name={field.name} ctx={ctx} />
        ))}
        {type === "testimonials" && (
          <LetterUpload
            attached={hasLetter || newLetter}
            onUploaded={(key) => ctx.setValue("letterKey", key)}
          />
        )}
        <Checkbox
          name="consentConfirmed"
          label={t("consent.label")}
          hint={t("consent.hint")}
          checked={ctx.values.consentConfirmed === true}
          onChange={(event) => ctx.setValue("consentConfirmed", event.target.checked)}
        />
      </Card>
      <PublishPanel editor={editor} />
      <EditorActions editor={editor} />
    </form>
  );
}
