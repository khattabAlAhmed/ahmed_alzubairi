"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Button, TextField } from "@/components/ui";
import { useFieldText, type FieldRendererProps } from "./field-text";
import type { ImageValue } from "./form-values";
import { acceptFor, mediaUrl, uploadFile, UploadError } from "./upload";

/** A button that opens a file picker, uploads the file and returns its key. */
function UploadButton({
  target,
  image,
  label,
  describedBy,
  onUploaded,
  onError,
}: {
  target: Parameters<typeof uploadFile>[1];
  image: boolean;
  label: string;
  describedBy?: string;
  onUploaded: (key: string) => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useFieldText();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      onUploaded(await uploadFile(file, target));
    } catch (error) {
      onError(
        error instanceof UploadError && error.serverMessage
          ? error.serverMessage
          : t("upload.failed"),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept={acceptFor(target, image)}
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        loadingLabel={t("upload.uploading")}
        aria-describedby={describedBy}
        onClick={() => input.current?.click()}
      >
        {busy ? t("upload.uploading") : label}
      </Button>
    </>
  );
}

function Preview({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={320}
      height={200}
      sizes="(min-width: 640px) 320px, 100vw"
      className="h-auto max-h-48 w-full max-w-xs rounded-md border border-text/10 object-contain"
    />
  );
}

/** One uploaded file (`image` or `file`). The body stores the returned key. */
export function UploadInput({ field, name, ctx }: FieldRendererProps) {
  const text = useFieldText();
  const id = useId();
  const [uploadError, setUploadError] = useState<string | null>(null);
  if (field.kind !== "image" && field.kind !== "file") return null;

  const value = typeof ctx.values[name] === "string" ? (ctx.values[name] as string) : "";
  const originalValue = ctx.original?.[name];
  // The API can't empty a field, so only a file added in this session can be removed.
  const removable = value !== "" && value !== originalValue;
  // Resources never return their key: a saved row has a file even when it's not shown.
  const hasSavedFile = value === "" && field.kind === "file" && ctx.original !== null && field.required;
  const isImage = field.kind === "image";
  const error = uploadError ?? text.error(ctx, name);
  const hintId = `${id}-hint`;

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-sm font-semibold">
        {text.label(field) + text.required(ctx, field, name)}
      </p>
      <p id={hintId} className="mt-1 text-sm text-text-secondary">
        {isImage ? text.t("upload.imageHint") : text.t("upload.fileHint")}
      </p>
      {value !== "" && isImage && (
        <div className="mt-2">
          <Preview src={mediaUrl(ctx.mediaBase, value)} alt={text.t("upload.preview")} />
        </div>
      )}
      {(value !== "" && !isImage) || hasSavedFile ? (
        <p className="mt-2 text-sm">{text.t("upload.attached")}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <UploadButton
          target={field.target}
          image={isImage}
          describedBy={hintId}
          label={value !== "" || hasSavedFile ? text.t("upload.replace") : text.t("upload.choose")}
          onUploaded={(key) => ctx.setValue(name, key)}
          onError={setUploadError}
        />
        {removable && (
          <Button variant="quiet" size="sm" onClick={() => ctx.setValue(name, "")}>
            {text.t("upload.remove")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A project's images, each with alt text in both languages. */
export function ImagesInput({
  field,
  name,
  ctx,
  images,
}: FieldRendererProps & { images: ImageValue[] }) {
  const text = useFieldText();
  const [uploadError, setUploadError] = useState<string | null>(null);
  if (field.kind !== "images") return null;
  const error = uploadError ?? text.error(ctx, name);

  const update = (index: number, change: Partial<ImageValue>) =>
    ctx.setValue(
      name,
      images.map((image, i) => (i === index ? { ...image, ...change } : image)),
    );

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{text.label(field)}</legend>
      <p className="mt-1 text-sm text-text-secondary">{text.t("upload.imageHint")}</p>
      {images.length > 0 && (
        <ul className="mt-3 grid gap-4 md:grid-cols-2">
          {images.map((image, index) => (
            <li key={image.key} className="space-y-3 rounded-md border border-text/10 p-3">
              <p className="text-sm font-semibold">
                {text.t("upload.imageNumber", { number: index + 1 })}
              </p>
              <Preview
                src={mediaUrl(ctx.mediaBase, image.key)}
                alt={image.altAr || image.altEn || text.t("upload.preview")}
              />
              <TextField
                label={text.t("upload.altAr")}
                lang="ar"
                dir="rtl"
                value={image.altAr}
                onChange={(event) => update(index, { altAr: event.target.value })}
              />
              <TextField
                label={text.t("upload.altEn")}
                lang="en"
                dir="ltr"
                value={image.altEn}
                onChange={(event) => update(index, { altEn: event.target.value })}
              />
              <Button
                variant="quiet"
                size="sm"
                onClick={() => ctx.setValue(name, images.filter((_, i) => i !== index))}
              >
                {text.t("upload.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <UploadButton
          target={field.target}
          image
          label={text.t("upload.add")}
          onUploaded={(key) => ctx.setValue(name, [...images, { key, altAr: "", altEn: "" }])}
          onError={setUploadError}
        />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
