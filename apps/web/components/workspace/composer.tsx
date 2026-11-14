"use client";

import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE, MAX_LONG_TEXT_LENGTH } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useId, type FormEvent } from "react";
import { Button, buttonClasses, TextArea } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { FileChip, type FileChipData } from "./file-chip";
import { allowedTypeNames, attachmentAccept, formatBytes, joinList } from "./format";
import { PaperclipIcon, SendIcon } from "./icons";

export type ComposerProps = {
  /** The typed text. The parent owns it, so an error never clears it. */
  value: string;
  onChange: (value: string) => void;
  /** The files on the message, in every state. */
  files: FileChipData[];
  /** Files the member picked. Check them with `attachmentRefusal` before upload. */
  onAttach: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onSend: () => void;
  sending?: boolean;
  /** Shown above the send button. The text and files stay as they are. */
  error?: string;
  /** Overrides the label, such as "Reply". */
  label?: string;
  className?: string;
};

/**
 * The chat composer (§6.17): text, attach, the files as chips, the limit
 * line, an error slot and send. Presentational: the parent uploads and sends.
 * Send waits while a file is uploading, and needs text or a ready file.
 */
export function Composer({
  value,
  onChange,
  files,
  onAttach,
  onRemoveFile,
  onSend,
  sending = false,
  error,
  label,
  className,
}: ComposerProps) {
  const t = useTranslations("Workspace.composer");
  const locale = useLocale();
  const limitsId = useId();
  const errorId = useId();
  const uploading = files.some((file) => file.state === "uploading");
  const counted = files.filter((file) => file.state !== "refused").length;
  const full = counted >= MAX_ATTACHMENTS_PER_MESSAGE;
  const hasContent = value.trim() !== "" || files.some((file) => file.state === "ready");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || uploading || !hasContent) return;
    onSend();
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-describedby={error ? errorId : undefined}
      className={cx("space-y-3 rounded-lg border border-text/10 bg-surface p-4 shadow-sm", className)}
    >
      <TextArea
        label={label ?? t("label")}
        placeholder={t("placeholder")}
        rows={4}
        value={value}
        maxLength={MAX_LONG_TEXT_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        dir="auto"
      />

      {files.length > 0 && (
        <ul aria-label={t("files")} className="grid gap-2 sm:grid-cols-2">
          {files.map((file) => (
            <li key={file.id} className="min-w-0">
              <FileChip file={file} onRemove={sending ? undefined : onRemoveFile} />
            </li>
          ))}
        </ul>
      )}

      <p id={limitsId} className="text-xs text-text-secondary">
        {t("limits", {
          count: MAX_ATTACHMENTS_PER_MESSAGE,
          size: formatBytes(MAX_ATTACHMENT_BYTES, locale),
          types: joinList(allowedTypeNames(), locale),
        })}
      </p>

      {error && (
        <p id={errorId} role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* A real file input behind a styled label: keyboard and screen readers get the native control. */}
        <label
          className={cx(
            buttonClasses({ variant: "secondary", size: "sm" }),
            "cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
            (full || sending) && "pointer-events-none opacity-50",
          )}
        >
          <PaperclipIcon />
          {t("attach")}
          <input
            type="file"
            multiple
            accept={attachmentAccept()}
            disabled={full || sending}
            aria-describedby={limitsId}
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              // Cleared, so picking the same file again after removing it still fires.
              event.target.value = "";
              if (picked.length > 0) onAttach(picked);
            }}
          />
        </label>
        <Button
          type="submit"
          disabled={!hasContent || uploading}
          loading={sending}
          loadingLabel={t("sending")}
          icon={<SendIcon />}
        >
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}
