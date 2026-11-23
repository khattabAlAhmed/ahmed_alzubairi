"use client";

import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { fileKind, formatBytes, type RefusalReason } from "./format";
import { CheckIcon } from "@/components/icons";
import { AlertIcon, FileKindIcon, XIcon } from "./icons";
import { metaSeparator } from "@/components/public/home/format";

export type FileChipData = {
  id: string;
  name: string;
  sizeBytes: number;
  mime: string;
  state: "uploading" | "ready" | "refused";
  /** 0–100, while uploading. */
  progress?: number;
  /** Why it was refused. */
  reason?: RefusalReason;
  /** Where a ready file opens. The name becomes a link. */
  href?: string;
};

/**
 * One file row (the FileInput board): an icon, the name, a data line (size and
 * state) and an action. Uploading shows a 2px meter along the bottom; ready
 * shows a check; refused shows a cross, the danger edge and the reason, in
 * words. A failed upload offers `onRetry`. The size is Latin data (mono, LTR),
 * like the board's "2.4 MB".
 */
export function FileChip({
  file,
  onRemove,
  onRetry,
  retryLabel,
  className,
}: {
  file: FileChipData;
  onRemove?: (id: string) => void;
  /** Offered when the upload failed, next to the reason. */
  onRetry?: (id: string) => void;
  /** The retry button's text, such as "Try again". Required with `onRetry`. */
  retryLabel?: string;
  className?: string;
}) {
  const t = useTranslations("Workspace.file");
  const locale = useLocale();
  const kind = fileKind(file.mime);
  const refused = file.state === "refused";
  const failed = refused && file.reason === "failed";
  const progress = Math.min(100, Math.max(0, Math.round(file.progress ?? 0)));
  const reason =
    file.reason &&
    t(`reasons.${file.reason}`, {
      size: formatBytes(MAX_ATTACHMENT_BYTES, locale),
      count: MAX_ATTACHMENTS_PER_MESSAGE,
    });

  return (
    <div
      data-state={file.state}
      className={cx(
        "relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border bg-bg px-3 py-2.5",
        refused ? "border-danger" : "border-line",
        className,
      )}
    >
      <span className={cx("mt-0.5", refused ? "text-danger" : file.state === "ready" ? "text-success" : "text-ink-2")}>
        {failed ? <AlertIcon /> : refused ? <XIcon /> : file.state === "ready" ? <CheckIcon /> : <FileKindIcon kind={kind} />}
      </span>
      <div className="min-w-0">
        {/* The name is text, never HTML (§9). It wraps anywhere, so a long name never widens the page. */}
        {/* `dir="auto"`: an English file name on an Arabic page starts on its own side. */}
        <p dir="auto" className="text-start text-[15px] leading-normal wrap-anywhere">
          {file.href && file.state === "ready" ? (
            <a
              href={file.href}
              className="text-accent underline decoration-1 underline-offset-4 transition-state hover:decoration-2 focus-ring"
            >
              <bdi>{file.name}</bdi>
            </a>
          ) : (
            <bdi>{file.name}</bdi>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] leading-[1.7] text-ink-2">
          <span>{t(`types.${kind}`)}</span>
          <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
          <span dir="ltr" className="font-mono text-xs">
            {formatBytes(file.sizeBytes, "en")}
          </span>
          {file.state === "uploading" && (
            <>
              <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
              <span>{t("uploading", { percent: progress })}</span>
            </>
          )}
          {file.state === "ready" && (
            <>
              <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
              <span>{t("ready")}</span>
            </>
          )}
          {refused && (
            <>
              <span aria-hidden="true">{metaSeparator(locale).trim()}</span>
              <span className="text-danger">{t("refused")}</span>
            </>
          )}
        </p>
        {refused && reason && (
          <p role="alert" className="mt-0.5 text-[13px] leading-[1.7] text-danger">
            {reason}
          </p>
        )}
      </div>
      <div className="-my-1 flex items-center">
        {failed && onRetry && retryLabel && (
          <button
            type="button"
            onClick={() => onRetry(file.id)}
            className="min-h-11 px-0.5 text-sm text-accent underline decoration-1 underline-offset-6 transition-state hover:decoration-2 focus-ring"
          >
            {retryLabel}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(file.id)}
            aria-label={t("remove", { name: file.name })}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center text-ink transition-state hover:bg-surface-hover focus-ring"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      {file.state === "uploading" && (
        <div
          role="progressbar"
          aria-label={file.name}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="col-span-full h-0.5 bg-line"
        >
          {/* Logical width, so it fills from the start side in both languages. */}
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
