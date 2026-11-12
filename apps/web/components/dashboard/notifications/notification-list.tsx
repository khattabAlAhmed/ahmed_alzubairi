"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type MouseEvent } from "react";
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

type Notice = { tone: "status" | "alert"; text: string };

/**
 * The member's latest notifications (§6.21). Each row is a link to its
 * section; opening it marks it read. "Mark all as read" clears the counter.
 * After either, the page and the menu are read again from the server.
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

  async function markAll() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await sendRead();
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "alert", text: result.message ?? t("failed") });
      return;
    }
    setNotice({ tone: "status", text: t("markedAll") });
    router.refresh();
  }

  async function open(event: MouseEvent<HTMLAnchorElement>, item: NotificationItem) {
    if (item.readAt !== null) return;
    const plain =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
    if (!plain) {
      // A new tab: this page stays, so mark it and read the page again.
      void sendRead([item.id], { keepalive: true }).then(() => router.refresh());
      return;
    }
    // Mark it first, so the section opens with the count already lower. A
    // failed mark doesn't keep the member from the section.
    event.preventDefault();
    await sendRead([item.id], { keepalive: true });
    router.push(item.href);
  }

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
      {notice && (
        <p
          role={notice.tone}
          className={cx(
            "text-sm font-semibold",
            notice.tone === "alert" ? "text-danger" : "text-text",
          )}
        >
          {notice.text}
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
