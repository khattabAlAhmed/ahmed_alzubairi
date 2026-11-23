"use client";

import type { ContactMessage } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge, Button, buttonClasses } from "@/components/ui";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { LocalTime } from "@/components/consultations/local-time";
import { replyHref, sendRead } from "./send";
import { metaSeparator } from "@/components/public/home/format";

type Notice = { tone: "status" | "alert"; text: string };

function MessageItem({ message }: { message: ContactMessage }) {
  const t = useTranslations("DashboardMessages");
  const locale = useLocale();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(message.readAt !== null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function mark(next: boolean) {
    setBusy(true);
    const result = await sendRead(message.id, next);
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "alert", text: result.message ?? t("row.failed") });
      return false;
    }
    setRead(next);
    return true;
  }

  async function toggle() {
    const opening = !open;
    setOpen(opening);
    setNotice(null);
    // Opening a message marks it read.
    if (opening && !read && !busy) await mark(true);
  }

  async function markUnread() {
    if (busy) return;
    if (await mark(false)) {
      setOpen(false);
      setNotice({ tone: "status", text: t("row.markedUnread") });
    }
  }

  return (
    <li className="p-4">
      {/* Every value below is rendered as text, never as HTML (§9). */}
      <h2 className="text-base">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className={cx(
            "flex w-full flex-col gap-1 text-start sm:flex-row sm:items-start sm:justify-between sm:gap-4",
            FOCUS_RING,
          )}
        >
          <span className="min-w-0">
            <span
              className={cx(
                "block break-words",
                read ? "font-normal" : "font-bold",
              )}
            >
              <bdi>{message.subject}</bdi>
            </span>
            <span className="mt-0.5 block break-words text-sm font-normal text-ink-2">
              <bdi>{message.name}</bdi>
              {metaSeparator(locale)}
              {t(`orgTypes.${message.orgType}`)}
            </span>
            <span className="block text-sm font-normal wrap-anywhere text-ink-2">
              <bdi dir="ltr">{message.email}</bdi>
            </span>
          </span>
          <span className="flex shrink-0 flex-wrap items-center gap-2 text-sm font-normal text-ink-2">
            <Badge tone={read ? "neutral" : "strong"}>
              {read ? t("row.read") : t("row.unread")}
            </Badge>
            <LocalTime value={message.createdAt} />
          </span>
        </button>
      </h2>
      {notice && (
        <p
          role={notice.tone}
          className={cx(
            "mt-2 text-sm font-semibold",
            notice.tone === "alert" ? "text-danger" : "text-ink",
          )}
        >
          {notice.text}
        </p>
      )}
      <div id={panelId} hidden={!open} className="mt-3 space-y-4">
        <p
          dir="auto"
          className="max-w-prose whitespace-pre-wrap break-words border border-ink/10 bg-bg p-3"
        >
          {message.message}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={replyHref(message.email)}
            className={buttonClasses({ size: "sm" })}
          >
            {t("row.reply")}
          </a>
          <Button
            variant="secondary"
            size="sm"
            onClick={markUnread}
            disabled={busy || !read}
          >
            {t("row.markUnread")}
          </Button>
        </div>
      </div>
    </li>
  );
}

/** The page's messages. Opening one shows its text and marks it read. */
export function MessageList({ messages }: { messages: ContactMessage[] }) {
  return (
    <ul className="divide-y divide-ink/10 border border-ink/10 bg-surface">
      {messages.map((message) => (
        // The key carries the stored state, so a reload resets the row's own.
        <MessageItem key={`${message.id}:${message.readAt}`} message={message} />
      ))}
    </ul>
  );
}
