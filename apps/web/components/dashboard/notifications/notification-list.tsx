"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Badge, Button } from "@/components/ui";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link, useRouter } from "@/i18n/navigation";
import type { NotificationItem } from "./data";
import { sendRead } from "./send";

const subscribe = () => () => {};

/**
 * A time in the viewer's locale and time zone. The server doesn't know the
 * zone, so the text is filled in by the browser.
 */
function LocalTime({ value }: { value: string }) {
  const locale = useLocale();
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <time dateTime={value}>
      {inBrowser &&
        new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))}
    </time>
  );
}

/** `at` is the unread count the notice was shown with. */
type Notice = { tone: "status" | "alert"; text: string; at: number };

/**
 * The member's latest notifications (§6.21). Each row is a link to its
 * section; opening it marks it read. "Mark all as read" clears the counter.
 * After either, the page and the menu are read again from the server.
 * `items` is one page; `unread` counts every page.
 */
export function NotificationList({
  items,
  unread,
}: {
  items: NotificationItem[];
  /** Every unread notification the member has, not only the ones listed. */
  unread: number;
}) {
  const t = useTranslations("DashboardNotifications");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Set while one notification is being opened: a second one waits its turn,
  // so a slow first request can't pull the member away from the second.
  const opening = useRef(false);

  async function markAll() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await sendRead();
    setBusy(false);
    setNotice(
      result.ok
        ? { tone: "status", text: t("markedAll"), at: unread }
        : { tone: "alert", text: result.message ?? t("failed"), at: unread },
    );
    // Read the page again either way. The rows may be marked even when the
    // answer failed (the count is read after the update), and the screen
    // must show what the server has.
    router.refresh();
  }

  /** A new tab: this page stays, so mark it and read the page again. */
  function markInPlace(item: NotificationItem) {
    if (item.readAt !== null) return;
    void sendRead([item.id], { keepalive: true }).then(() => router.refresh());
  }

  async function open(event: MouseEvent<HTMLAnchorElement>, item: NotificationItem) {
    const plain =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    if (!plain) {
      markInPlace(item);
      return;
    }
    if (opening.current) {
      event.preventDefault();
      return;
    }
    if (item.readAt !== null) return;
    // Mark it first, so the section opens with the count already lower. A
    // failed mark doesn't keep the member from the section.
    event.preventDefault();
    opening.current = true;
    try {
      await sendRead([item.id], { keepalive: true });
    } finally {
      opening.current = false;
    }
    router.push(item.href);
  }

  // A failure notice is dropped once the count it was shown with has changed:
  // the page was read again and the change turned out to be saved.
  const shown =
    notice && (notice.tone === "status" || notice.at === unread) ? notice : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-text-secondary">
          {t("summary", { count: unread })}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={markAll}
          disabled={unread === 0}
          loading={busy}
          loadingLabel={t("marking")}
        >
          {t("markAll")}
        </Button>
      </div>
      {shown && (
        <p
          role={shown.tone}
          className={cx(
            "text-sm font-semibold",
            shown.tone === "alert" ? "text-danger" : "text-text",
          )}
        >
          {shown.text}
        </p>
      )}
      <ul
        aria-label={t("listLabel")}
        className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface"
      >
        {items.map((item) => {
          const read = item.readAt !== null;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={(event) => open(event, item)}
                // A middle click opens a new tab and sends no `click`.
                onAuxClick={(event) => {
                  if (event.button === 1) markInPlace(item);
                }}
                className={cx(
                  "flex flex-col gap-1 rounded-md p-4 hover:bg-text/5 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                  FOCUS_RING,
                )}
              >
                <span className="min-w-0">
                  <span className={cx("block break-words", read ? "font-normal" : "font-bold")}>
                    {t(`types.${item.typeKey}`)}
                  </span>
                  <span className="mt-0.5 block text-sm text-text-secondary">
                    {t("row.opens", { section: t(`sections.${item.section}`) })}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-text-secondary">
                  <Badge tone={read ? "neutral" : "strong"}>
                    {read ? t("row.read") : t("row.unread")}
                  </Badge>
                  <LocalTime value={item.createdAt} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
