"use client";

import { useLocale, useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { FileChip, type FileChipData } from "./file-chip";
import { useInBrowser } from "./use-in-browser";

export type ChatMessageProps = {
  senderName: string;
  /** The viewer's own message: it sits on the end side and says "You". */
  mine: boolean;
  /** Plain text. Null for a message that only carries files. */
  body: string | null;
  /** UTC, ISO 8601. */
  sentAt: string;
  /** Ready files on the message. */
  attachments?: FileChipData[];
  /** A fixed zone, such as a saved profile zone. Without it, the viewer's browser zone. */
  timeZone?: string;
  className?: string;
};

/**
 * One chat message (§6.17): who, when (in the viewer's locale and zone, the
 * zone named), the text and its files. The body is rendered as text with its
 * line breaks kept, never as HTML (§9): `<b>` shows as `<b>`.
 */
export function ChatMessage({
  senderName,
  mine,
  body,
  sentAt,
  attachments = [],
  timeZone,
  className,
}: ChatMessageProps) {
  const t = useTranslations("Workspace.chat");
  const locale = useLocale();
  const inBrowser = useInBrowser();
  const date = new Date(sentAt);
  const showTime = inBrowser || timeZone !== undefined;

  return (
    <article
      aria-label={mine ? t("you") : t("sentBy", { name: senderName })}
      className={cx("flex", mine ? "justify-end" : "justify-start", className)}
    >
      <div
        className={cx(
          "min-w-0 max-w-[88%] space-y-2 rounded-lg border px-4 py-3 sm:max-w-[75%]",
          mine ? "border-text/15 bg-text/5" : "border-text/10 bg-surface shadow-sm",
        )}
      >
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className="min-w-0 text-sm font-semibold wrap-anywhere">
            {mine ? t("you") : <bdi>{senderName}</bdi>}
          </p>
          <p className="text-xs text-text-secondary">
            <time dateTime={sentAt}>
              {showTime &&
                // Explicit fields: `dateStyle` can't be combined with `timeZoneName`.
                new Intl.DateTimeFormat(locale, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZoneName: "short",
                  timeZone,
                }).format(date)}
            </time>
          </p>
        </header>
        {body !== null && body !== "" && (
          // `dir="auto"`: an English message on an Arabic page starts on its own side.
          <p dir="auto" className="text-start leading-relaxed whitespace-pre-wrap wrap-anywhere">
            {body}
          </p>
        )}
        {attachments.length > 0 && (
          <ul aria-label={t("attachments")} className="grid gap-2">
            {attachments.map((file) => (
              <li key={file.id} className="min-w-0">
                <FileChip file={file} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
