"use client";

import { LETTER_MAX_PARAGRAPHS, type Locale } from "@repo/shared";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button, Checkbox, TextArea } from "@/components/ui";
import { isolate, useFieldText } from "../content/field-text";
import { mediaUrl, uploadFile, UploadError } from "../content/upload";
import {
  inputName,
  isSignatureFile,
  moveParagraph,
  SIGNATURE_ACCEPT,
  type LetterValues,
  type SectionErrors,
  type SignatureField,
} from "./section-content";

/** One language's paragraphs: edit, add, remove and reorder, 1 to 6. */
export function ParagraphList({
  locale,
  paragraphs,
  errors,
  onChange,
}: {
  locale: Locale;
  paragraphs: string[];
  errors: SectionErrors;
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("DashboardHome.letter");
  const text = useFieldText();
  const [status, setStatus] = useState("");
  const listError = errors[inputName(locale, "paragraphs")];
  const count = paragraphs.length;

  const move = (index: number, by: -1 | 1) => {
    onChange(moveParagraph(paragraphs, index, by));
    setStatus(t("moved", { number: index + 1, position: index + by + 1, total: count }));
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">
        {isolate(`${t("paragraphs")} ${text.t("editor.requiredMark")}`)}
      </legend>
      <p className="text-sm text-text-secondary">
        {isolate(t("paragraphsHint", { max: LETTER_MAX_PARAGRAPHS }))}
      </p>
      <ol className="space-y-3">
        {paragraphs.map((paragraph, index) => {
          const name = inputName(locale, `paragraphs.${index}`);
          const problem = errors[name];
          const number = index + 1;
          return (
            // Paragraphs have no id; the index keys them, and the text moves with it.
            // A hairline between paragraphs on phones (full width); a box from 640px.
            <li key={index} className="space-y-2 border-t border-line pt-3 sm:border sm:p-3">
              <TextArea
                name={name}
                rows={4}
                label={isolate(t("paragraph", { number }))}
                value={paragraph}
                error={problem ? isolate(text.t(`editor.${problem}`)) : undefined}
                onChange={(event) =>
                  onChange(paragraphs.map((item, i) => (i === index ? event.target.value : item)))
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={index === 0}
                  aria-label={t("moveUp", { number })}
                  onClick={() => move(index, -1)}
                >
                  {t("up")}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={index === count - 1}
                  aria-label={t("moveDown", { number })}
                  onClick={() => move(index, 1)}
                >
                  {t("down")}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={count === 1}
                  aria-label={t("removeLabel", { number })}
                  onClick={() => {
                    onChange(paragraphs.filter((_, i) => i !== index));
                    setStatus(t("removed", { number }));
                  }}
                >
                  {t("remove")}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {listError && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {isolate(text.t(`editor.${listError}`))}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={count >= LETTER_MAX_PARAGRAPHS}
        onClick={() => {
          onChange([...paragraphs, ""]);
          setStatus(t("added", { number: count + 1 }));
        }}
      >
        {t("add")}
      </Button>
      {count >= LETTER_MAX_PARAGRAPHS && (
        <p className="text-sm text-text-secondary">{isolate(t("full", { max: LETTER_MAX_PARAGRAPHS }))}</p>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
    </fieldset>
  );
}

/**
 * One signature scan, PNG only, through the `media` upload target. The
 * preview sits on the theme it's for, in both dashboard themes.
 */
function SignatureInput({
  field,
  value,
  original,
  mediaBase,
  error,
  onChange,
  onUploading,
}: {
  field: SignatureField;
  value: string;
  original: string;
  mediaBase: string;
  error?: string;
  onChange: (key: string) => void;
  /** Tells the editor an upload is running, so it won't save without the key. */
  onUploading: (field: SignatureField, busy: boolean) => void;
}) {
  const t = useTranslations("DashboardHome.letter");
  const text = useFieldText();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const shown = uploadError ?? error;
  const forDark = field === "signatureDarkKey";

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!isSignatureFile(file)) {
      setUploadError(t("pngOnly"));
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    onUploading(field, true);
    setUploadError(null);
    try {
      onChange(await uploadFile(file, "media"));
    } catch (problem) {
      setUploadError(
        problem instanceof UploadError && problem.serverMessage ? problem.serverMessage : text.t("upload.failed"),
      );
    } finally {
      setBusy(false);
      onUploading(field, false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="space-y-2">
      <p id={`${id}-label`} className="text-sm font-semibold">
        {t(forDark ? "signatureDark" : "signature")}
      </p>
      <p id={`${id}-hint`} className="text-sm text-text-secondary">
        {isolate(t(forDark ? "signatureDarkHint" : "signatureHint"))}
      </p>
      {value !== "" && (
        // Each scan on its own theme's ground, whatever the dashboard's theme.
        <div data-theme={forDark ? "dark" : "light"} className="max-w-xs border border-line bg-bg p-3">
          <Image
            src={mediaUrl(mediaBase, value)}
            alt={t("signatureAlt")}
            width={320}
            height={120}
            sizes="320px"
            className="h-auto max-h-28 w-full object-contain"
          />
        </div>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={SIGNATURE_ACCEPT}
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          loadingLabel={text.t("upload.uploading")}
          aria-describedby={`${id}-hint`}
          onClick={() => input.current?.click()}
        >
          {busy ? text.t("upload.uploading") : value !== "" ? text.t("upload.replace") : text.t("upload.choose")}
        </Button>
        {/* The API can't empty a field, so only a scan added in this session can be removed. */}
        {value !== "" && value !== original && (
          <Button variant="quiet" size="sm" onClick={() => onChange(original)}>
            {text.t("upload.remove")}
          </Button>
        )}
      </div>
      {shown && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {isolate(shown)}
        </p>
      )}
    </div>
  );
}

/** The letter's fields shared by both languages: the signatures and the placeholder switch. */
export function LetterSharedFields({
  letter,
  original,
  mediaBase,
  errors,
  onChange,
  onUploading,
}: {
  letter: LetterValues;
  original: LetterValues;
  mediaBase: string;
  errors: SectionErrors;
  /** A patch, merged into the editor's latest letter: never a copy of this render's. */
  onChange: (patch: Partial<LetterValues>) => void;
  onUploading: (field: SignatureField, busy: boolean) => void;
}) {
  const t = useTranslations("DashboardHome.letter");
  const text = useFieldText();
  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">{t("sharedNote")}</p>
      <div className="grid gap-6 md:grid-cols-2">
        {(["signatureKey", "signatureDarkKey"] as const).map((field) => (
          <SignatureInput
            key={field}
            field={field}
            value={letter[field]}
            original={original[field]}
            mediaBase={mediaBase}
            error={errors[field] ? text.t(`editor.${errors[field]}`) : undefined}
            onChange={(key) => onChange({ [field]: key })}
            onUploading={onUploading}
          />
        ))}
      </div>
      <Checkbox
        name="isPlaceholder"
        label={t("placeholder")}
        hint={t("placeholderHint")}
        checked={letter.isPlaceholder}
        onChange={(event) => onChange({ isPlaceholder: event.target.checked })}
      />
    </div>
  );
}
