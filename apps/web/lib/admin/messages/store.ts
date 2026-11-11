import "server-only";
import type { Database, Tables } from "@repo/db";
import {
  orgTypeSchema,
  pageRange,
  type ContactMessage,
  type ContactMessageList,
  type MessageListParams,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchPattern } from "../team/store";

type Client = SupabaseClient<Database>;

/** A `contact_messages` row in the API shape. */
export function toMessage(row: Tables<"contact_messages">): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    // The table's check constraint allows only these values.
    orgType: orgTypeSchema.parse(row.org_type),
    subject: row.subject,
    message: row.message,
    readAt: row.read_at === null ? null : new Date(row.read_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * One page of contact messages, newest first. `user` carries the member's own
 * token, so RLS decides: without `messages.view` it returns nothing (§9).
 */
export async function listMessages(
  user: Client,
  params: MessageListParams,
): Promise<ContactMessageList> {
  const { from, to } = pageRange(params);
  let query = user.from("contact_messages").select("*", { count: "exact" });
  if (params.read === "unread") query = query.is("read_at", null);
  if (params.read === "read") query = query.not("read_at", "is", null);
  if (params.search) {
    const pattern = searchPattern(params.search);
    query = query.or(
      ["name", "email", "subject", "message"]
        .map((column) => `${column}.ilike.${pattern}`)
        .join(","),
    );
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  // Past the last page PostgREST answers "range not satisfiable": an empty page.
  if (error?.code === "PGRST103") return { messages: [], total: count ?? 0 };
  if (error) throw new Error(`messages list failed: ${error.code}`);
  return { messages: data.map(toMessage), total: count ?? data.length };
}

/**
 * Sets or clears `read_at` on one message. `service` is the service client:
 * call this only after `requirePermission(messages.view)` passed. False when
 * the message doesn't exist.
 */
export async function setMessageRead(
  service: Client,
  id: string,
  read: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  const { data, error } = await service
    .from("contact_messages")
    .update({ read_at: read ? now.toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`message update failed: ${error.code}`);
  return data.length > 0;
}
