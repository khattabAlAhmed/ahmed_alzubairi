import "server-only";
import type { EmailEvent } from "@repo/shared";
import {
  notificationTarget,
  notificationTypeKey,
  type NotificationSection,
} from "@/lib/notifications/links";
import {
  countUnread,
  LATEST_NOTIFICATIONS,
  listPage,
} from "@/lib/notifications/store";
import { createUserClient } from "@/lib/supabase/user";

/** One notification as the list shows it. */
export type NotificationItem = {
  id: string;
  /** The label key under `DashboardNotifications.types`. */
  typeKey: EmailEvent | "other";
  /** The section it leads to, and that section's path without the locale. */
  section: NotificationSection;
  href: string;
  readAt: string | null;
  createdAt: string;
};

/**
 * The member's unread count for the menu, read with their own client. The
 * menu must still show when this read fails, so a failure counts as zero and
 * logs its code only.
 */
export async function loadUnreadCount(userId: string): Promise<number> {
  try {
    return await countUnread(createUserClient(), userId);
  } catch (error) {
    console.error(
      "dashboard unread count",
      error instanceof Error ? error.message : "error",
    );
    return 0;
  }
}

/** The list's address for a page; page 1 has no query. */
export function notificationsPath(page: number): string {
  return page > 1 ? `/dashboard/notifications?page=${page}` : "/dashboard/notifications";
}

/** The page number from the query string: a whole number from 1, else 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const one = Array.isArray(raw) ? raw[0] : raw;
  if (one === undefined || !/^[1-9]\d{0,5}$/.test(one)) return 1;
  return Number(one);
}

/**
 * One page of the member's notifications, their unread count and how many
 * pages there are, read with their own client.
 */
export async function loadNotifications(
  userId: string,
  page: number,
): Promise<{ items: NotificationItem[]; unread: number; pages: number }> {
  const user = createUserClient();
  const [{ rows, total }, unread] = await Promise.all([
    listPage(user, userId, page),
    countUnread(user, userId),
  ]);
  return {
    unread,
    pages: Math.max(1, Math.ceil(total / LATEST_NOTIFICATIONS)),
    items: rows.map((row) => ({
      id: row.id,
      typeKey: notificationTypeKey(row.type),
      ...notificationTarget(row.entity),
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
  };
}
