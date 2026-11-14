import "server-only";
import type { Database } from "@repo/db";
import {
  documentAccessModeSchema,
  documentCategorySchema,
  documentRequestStatusSchema,
  type Locale,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/user";
import type { OwnRequest } from "./group";

type Client = SupabaseClient<Database>;

const COLUMNS =
  "id, document_id, status, consultation_id, expires_at, created_at, document:documents(title_ar, title_en, category, access_mode, mime)";

type Row = {
  id: string;
  document_id: string;
  status: string;
  consultation_id: string | null;
  expires_at: string | null;
  created_at: string;
  document: { title_ar: string; title_en: string; category: string; access_mode: string; mime: string } | null;
};

function toRequest(row: Row, locale: Locale): OwnRequest | null {
  const status = documentRequestStatusSchema.safeParse(row.status);
  const category = documentCategorySchema.safeParse(row.document?.category);
  const accessMode = documentAccessModeSchema.safeParse(row.document?.access_mode);
  if (!row.document || !status.success || !category.success || !accessMode.success) return null;
  // The other language's title stands in when this one is empty.
  const title =
    (locale === "ar" ? row.document.title_ar : row.document.title_en) ||
    row.document.title_ar ||
    row.document.title_en;
  return {
    id: row.id,
    documentId: row.document_id,
    title,
    category: category.data,
    accessMode: accessMode.data,
    mime: row.document.mime,
    status: status.data,
    consultationId: row.consultation_id,
    expiresAt: row.expires_at === null ? null : new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * The client's own requests, newest first, read with their own token: RLS
 * returns only theirs (§7). The filter only narrows what RLS already allows,
 * so a team member opening their own account page sees only their requests.
 */
export async function readOwnRequests(
  userId: string,
  locale: Locale,
  client: Client = createUserClient(),
): Promise<OwnRequest[]> {
  const { data, error } = await client
    .from("document_requests")
    .select(COLUMNS)
    .eq("client_id", userId)
    .order("created_at", { ascending: false })
    .order("id");
  if (error) throw new Error(`own document requests read failed: ${error.code}`);
  return (data as Row[]).flatMap((row) => toRequest(row, locale) ?? []);
}

/** One of the client's own requests, or null when it isn't theirs or doesn't exist. */
export async function readOwnRequest(
  userId: string,
  requestId: string,
  locale: Locale,
  client: Client = createUserClient(),
): Promise<OwnRequest | null> {
  const { data, error } = await client
    .from("document_requests")
    .select(COLUMNS)
    .eq("id", requestId)
    .eq("client_id", userId)
    .maybeSingle();
  if (error) throw new Error(`own document request read failed: ${error.code}`);
  return data ? toRequest(data as Row, locale) : null;
}
