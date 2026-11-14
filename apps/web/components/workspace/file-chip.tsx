"use client";

import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { fileKind, formatBytes, type RefusalReason } from "./format";
import { AlertIcon, FileKindIcon, XIcon } from "./icons";

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
 * One file: type icon, name, size and state. Uploading shows its progress,
 * refused shows the reason. With `onRemove`, a remove button.
 */
export function FileChip({
  file,
  onRemove,
  className,
}: {
  file: FileChipData;
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const t = useTranslations("Workspace.file");
  const locale = useLocale();
  const kind = fileKind(file.mime);
  const refused = file.state === "refused";
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
        "relative flex min-w-0 items-start gap-2.5 overflow-hidden rounded-md border bg-surface p-2.5 text-sm",
        refused ? "border-danger" : "border-text/20",
        className,
      )}
    >
      <span className={cx("mt-0.5 shrink-0", refused ? "text-danger" : "text-text-secondary")}>
        {refused ? <AlertIcon /> : <FileKindIcon kind={kind} />}
      </span>
      <div className="min-w-0 flex-1">
        {/* The name is text, never HTML (§9). It wraps anywhere, so a long name never widens the page. */}
        {/* `dir="auto"`: an English file name on an Arabic page starts on its own side. */}
        <p dir="auto" className="text-start font-semibold wrap-anywhere">
          {file.href && file.state === "ready" ? (
            <a href={file.href} className={cx("rounded-sm underline-offset-2 hover:underline", FOCUS_RING)}>
              <bdi>{file.name}</bdi>
            </a>
          ) : (
            <bdi>{file.name}</bdi>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-text-secondary">
          <span>{t(`types.${kind}`)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(file.sizeBytes, locale)}</span>
          {file.state === "uploading" && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t("uploading", { percent: progress })}</span>
            </>
          )}
          {refused && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-danger">{t("refused")}</span>
            </>
          )}
        </p>
        {refused && reason && (
          <p role="alert" className="mt-1 text-xs font-semibold text-danger">
            {reason}
          </p>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          aria-label={t("remove", { name: file.name })}
          className={cx(
            "-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-text/10 hover:text-text",
            FOCUS_RING,
          )}
        >
          <XIcon />
        </button>
      )}
      {file.state === "uploading" && (
        <div
          role="progressbar"
          aria-label={file.name}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="absolute inset-x-0 bottom-0 h-1 bg-text/10"
        >
          {/* Gold as an accent bar (§13). Logical width, so it fills from the start side in both languages. */}
          <div
            className="h-full bg-accent transition-[width] motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
