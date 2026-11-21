"use client";

import { useLocale, useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { formatDateTime } from "@/lib/time/format";
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
 * One message (§6.17, the ChatThread board): a consultation reads as
 * correspondence, never chat bubbles. A row: who and when in a fixed column
 * at the start, the text and its files beside it, a hairline under it. The
 * viewer's own messages sit on the `surface` ground, at the same start side
 * as everyone else's. The time is in the viewer's locale and zone, the zone
 * named. The body is text with its line breaks kept, never HTML (§9): `<b>`
 * shows as `<b>`.
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
      data-mine={mine || undefined}
      className={cx(
        "grid gap-x-6 gap-y-1.5 border-b border-line py-4 sm:grid-cols-[140px_minmax(0,1fr)]",
        mine && "-mx-4 bg-surface px-4",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 sm:flex-col sm:gap-0.5">
        <p className="min-w-0 text-sm font-medium wrap-anywhere">{mine ? t("you") : <bdi>{senderName}</bdi>}</p>
        <p className="text-xs text-ink-2">
          <time dateTime={sentAt}>{showTime && formatDateTime(date, locale, { timeZone })}</time>
        </p>
      </header>
      <div className="flex min-w-0 flex-col gap-2.5">
        {body !== null && body !== "" && (
          // `dir="auto"`: an English message on an Arabic page starts on its own side.
          <p dir="auto" className="text-start leading-[1.85] whitespace-pre-wrap wrap-anywhere [&:lang(en)]:leading-[1.6]">
            {body}
          </p>
        )}
        {attachments.length > 0 && (
          <ul aria-label={t("attachments")} className="grid gap-2 sm:grid-cols-2">
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
