"use client";

import {
  CONTENT_STATUSES,
  DOCUMENT_ACCESS_MODES,
  DOCUMENT_CATEGORIES,
  MAX_SHORT_TEXT_LENGTH,
  type AdminDocument,
  type ContentStatus,
  type DocumentAccessMode,
  type DocumentCategory,
} from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { UploadError, uploadFile } from "@/components/dashboard/content/upload";
import { Button, FieldError, FieldHint, Label, Select, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { formatBytes } from "@/components/workspace";
import { useRouter } from "@/i18n/navigation";
import {
  createDocument,
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  fileProblem,
  fileTypeLabel,
  updateDocument,
} from "./send";

type Values = {
  titleAr: string;
  titleEn: string;
  category: DocumentCategory;
  accessMode: DocumentAccessMode;
  status: ContentStatus;
};

type Field = "titleAr" | "titleEn" | "file";
type Notice = { ok: boolean; text: string };

/**
 * Adds a document (upload, then `POST /api/admin/documents`) or edits one
 * (`PATCH`, with a new file only when one is picked). The routes check
 * `documents.manage`; showing this form is not the check.
 */
export function DocumentForm({ document }: { document?: AdminDocument }) {
  const t = useTranslations("DashboardDocuments.form");
  const tw = useTranslations("Workspace.document");
  const ts = useTranslations("DashboardDocuments");
  const locale = useLocale();
  const router = useRouter();
  const fileId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Values>({
    titleAr: document?.titleAr ?? "",
    titleEn: document?.titleEn ?? "",
    category: document?.category ?? DOCUMENT_CATEGORIES[0],
    accessMode: document?.accessMode ?? "view",
    status: document?.status ?? "draft",
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const size = formatBytes(DOCUMENT_MAX_BYTES, locale);
  // Publish/Unpublish elsewhere on the page changes the saved status. The form
  // isn't remounted for that (unsaved edits stay); it takes the new status, so
  // a later save doesn't undo the publish.
  const [savedStatus, setSavedStatus] = useState(document?.status);
  if (document && savedStatus !== document.status) {
    setSavedStatus(document.status);
    setValues((current) => ({ ...current, status: document.status }));
  }

  function set<Key extends keyof Values>(key: Key, value: Values[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function check(): Partial<Record<Field, string>> {
    const found: Partial<Record<Field, string>> = {};
    if (!values.titleAr.trim()) found.titleAr = t("required");
    if (!values.titleEn.trim()) found.titleEn = t("required");
    if (file) {
      const problem = fileProblem(file);
      if (problem) found.file = t(problem, { size });
    } else if (!document) {
      found.file = t("fileRequired");
    }
    return found;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ ok: false, text: t("fixErrors") });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      let key: string | undefined;
      if (file) {
        try {
          key = await uploadFile(file, "document");
        } catch (error) {
          setNotice({
            ok: false,
            text: error instanceof UploadError && error.serverMessage ? error.serverMessage : t("uploadFailed"),
          });
          return;
        }
      }
      const fields = { ...values, titleAr: values.titleAr.trim(), titleEn: values.titleEn.trim() };
      if (!document) {
        const result = await createDocument({ ...fields, key: key ?? "" });
        if (!result.ok) {
          setNotice({ ok: false, text: result.message ?? t("failed") });
          return;
        }
        router.push(`/dashboard/documents/${encodeURIComponent(result.body.id)}`);
        return;
      }
      const result = await updateDocument({ id: document.id, ...fields, ...(key ? { key } : {}) });
      if (!result.ok) {
        setNotice({ ok: false, text: result.message ?? t("failed") });
        return;
      }
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setNotice({ ok: true, text: t("saved") });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fileHint = document ? t("replaceHint", { size }) : t("fileHint", { size });
  const fileDescribed = [`${fileId}-hint`, errors.file && `${fileId}-error`].filter(Boolean).join(" ");

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {/* Locked while a save runs, so nothing typed or picked meanwhile is lost. */}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={t("titleAr")}
            lang="ar"
            dir="rtl"
            value={values.titleAr}
            onChange={(event) => set("titleAr", event.target.value)}
            error={errors.titleAr}
            maxLength={MAX_SHORT_TEXT_LENGTH}
            required
          />
          <TextField
            label={t("titleEn")}
            lang="en"
            dir="ltr"
            value={values.titleEn}
            onChange={(event) => set("titleEn", event.target.value)}
            error={errors.titleEn}
            maxLength={MAX_SHORT_TEXT_LENGTH}
            required
          />
          <Select
            label={t("category")}
            value={values.category}
            onChange={(event) => set("category", event.target.value as DocumentCategory)}
          >
            {DOCUMENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tw(`categories.${category}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t("accessMode")}
            hint={t("accessModeHint")}
            value={values.accessMode}
            onChange={(event) => set("accessMode", event.target.value as DocumentAccessMode)}
          >
            {DOCUMENT_ACCESS_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {tw(`accessModes.${mode}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t("status")}
            hint={t("statusHint")}
            value={values.status}
            onChange={(event) => set("status", event.target.value as ContentStatus)}
          >
            {CONTENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ts(`status.${status}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fileId}>{document ? t("replaceFile") : t("file")}</Label>
          {document && (
            <p className="text-sm text-text-secondary">
              {t("currentFile", { type: fileTypeLabel(document.mime) })}
            </p>
          )}
          <input
            ref={fileInput}
            id={fileId}
            type="file"
            accept={DOCUMENT_ACCEPT}
            aria-invalid={errors.file ? true : undefined}
            aria-describedby={fileDescribed}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className={cx(
              "block w-full max-w-full rounded-md border border-text/50 bg-surface p-2 text-sm text-text",
              "file:me-3 file:rounded file:border-0 file:bg-text/10 file:px-3 file:py-1.5 file:text-text",
              "focus:outline-2 focus:outline-offset-1 focus:outline-ring aria-invalid:border-2 aria-invalid:border-danger",
            )}
          />
          <FieldHint id={`${fileId}-hint`}>{fileHint}</FieldHint>
          {errors.file && <FieldError id={`${fileId}-error`}>{errors.file}</FieldError>}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          loading={busy}
          loadingLabel={document ? t("saving") : t("creating")}
        >
          {document ? t("save") : t("create")}
        </Button>
        {notice && (
          <p
            role={notice.ok ? "status" : "alert"}
            className={cx("text-sm font-semibold", notice.ok ? "text-text" : "text-danger")}
          >
            {notice.text}
          </p>
        )}
      </div>
    </form>
  );
}
