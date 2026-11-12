import "server-only";
import type { EmailEvent } from "@repo/shared";
import {
  notificationTarget,
  notificationTypeKey,
  type NotificationSection,
} from "@/lib/notifications/links";
import { countUnread, listLatest } from "@/lib/notifications/store";
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

/** The member's latest notifications and unread count, with their own client. */
export async function loadNotifications(
  userId: string,
): Promise<{ items: NotificationItem[]; unread: number }> {
  const user = createUserClient();
  const [rows, unread] = await Promise.all([
    listLatest(user, userId),
    countUnread(user, userId),
  ]);
  return {
    unread,
    items: rows.map((row) => ({
      id: row.id,
      typeKey: notificationTypeKey(row.type),
      ...notificationTarget(row.entity),
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
  };
}
