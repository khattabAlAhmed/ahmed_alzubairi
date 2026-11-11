import "server-only";
import {
  messageListParamsSchema,
  type ContactMessageList,
  type MessageListParams,
} from "@repo/shared";
import { listMessages } from "@/lib/admin/messages/store";
import { createUserClient } from "@/lib/supabase/user";

type RawParams = Record<string, string | string[] | undefined>;

/**
 * The list's params from the page's query string. Only the known keys are
 * read, and a value the schema refuses falls back to its default, so a bad
 * link still opens the list.
 */
export function parseMessageParams(raw: RawParams): MessageListParams {
  const first = (key: string) => {
    const value = raw[key];
    const one = Array.isArray(value) ? value[0] : value;
    return one === undefined || one.trim() === "" ? undefined : one;
  };
  const keys = ["page", "pageSize", "search", "read"] as const;
  const kept = Object.fromEntries(
    keys.flatMap((key) => {
      const value = first(key);
      if (value === undefined) return [];
      const alone = messageListParamsSchema.safeParse({ [key]: value });
      return alone.success ? [[key, value]] : [];
    }),
  );
  return messageListParamsSchema.parse(kept);
}

/**
 * One page of messages, read with the member's own client: RLS allows
 * `messages.view`. Call it only after the page checked that permission.
 */
export function loadMessages(params: MessageListParams): Promise<ContactMessageList> {
  return listMessages(createUserClient(), params);
}

/** The list's address with these params; defaults are left out. */
export function messagesPath(params: {
  page?: number;
  search?: string;
  read?: MessageListParams["read"];
}): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.read) query.set("read", params.read);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/dashboard/messages?${text}` : "/dashboard/messages";
}
