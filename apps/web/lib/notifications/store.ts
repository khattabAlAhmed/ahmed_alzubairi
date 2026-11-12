import "server-only";
import type { Database } from "@repo/db";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** How many notifications the dashboard's list shows. */
export const LATEST_NOTIFICATIONS = 20;

/** A `notifications` row as the list needs it. Times are ISO strings in UTC. */
export type NotificationRow = {
  id: string;
  type: string;
  entity: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * The member's unread notifications (§6.21). `user` carries their own token,
 * so RLS returns only their rows; the filter says the same and uses the index.
 */
export async function countUnread(user: Client, userId: string): Promise<number> {
  const { count, error } = await user
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(`notifications count failed: ${error.code}`);
  return count ?? 0;
}

/** The member's latest notifications, newest first, through their own client. */
export async function listLatest(
  user: Client,
  userId: string,
  limit: number = LATEST_NOTIFICATIONS,
): Promise<NotificationRow[]> {
  const { data, error } = await user
    .from("notifications")
    .select("id, type, entity, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw new Error(`notifications list failed: ${error.code}`);
  return data.map((row) => ({
    id: row.id,
    type: row.type,
    entity: row.entity,
    readAt: row.read_at === null ? null : new Date(row.read_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

/**
 * Marks the caller's unread notifications read: the ones in `ids`, or all of
 * them. `service` is the service client, because `authenticated` can only
 * read the table: call this only after the route has checked the session, and
 * only with that session's `userId`. Every update is filtered to that user,
 * so an id that belongs to someone else matches nothing.
 */
export async function markRead(
  service: Client,
  userId: string,
  ids?: readonly string[],
  now: Date = new Date(),
): Promise<void> {
  const mine = service
    .from("notifications")
    .update({ read_at: now.toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  const { error } = await (ids ? mine.in("id", [...ids]) : mine);
  if (error) throw new Error(`notifications update failed: ${error.code}`);
}
