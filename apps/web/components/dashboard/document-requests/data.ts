import "server-only";
import type { Database } from "@repo/db";
import {
  adminDocumentRequestSchema,
  documentRequestListParamsSchema,
  LOCALES,
  pageRange,
  PERMISSIONS,
  uuidSchema,
  type AdminDocumentRecommendation,
  type AdminDocumentRequest,
  type AdminDocumentRequestList,
  type Locale,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantedPermissions } from "@/components/dashboard/access";
import { profileNames } from "@/components/dashboard/documents/data";
import { searchPattern } from "@/lib/admin/team/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";

type Client = SupabaseClient<Database>;

export type RequestsAccess = {
  locale: Locale;
  /** `document_requests.recommend`: the section opens, and the recommend form shows. */
  allowed: boolean;
  /** `document_requests.decide`: grant, contact first, withdraw and the access log. */
  canDecide: boolean;
};

const REQUEST_KEYS = [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND, PERMISSIONS.DOCUMENT_REQUESTS_DECIDE];

/**
 * Who may open Document requests, decided on the server with
 * `has_permission`. Pages call `requireTeamMember` first, then this, and show
 * `<Refusal />` when `allowed` is false.
 */
export async function requestsAccess(
  params: Promise<{ locale: string }>,
  check: typeof grantedPermissions = grantedPermissions,
): Promise<RequestsAccess> {
  const { locale: raw } = await params;
  // requireTeamMember already sent unknown locales to "not found".
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  const granted = await check(REQUEST_KEYS, locale);
  return {
    locale,
    allowed: granted.has(PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND),
    canDecide: granted.has(PERMISSIONS.DOCUMENT_REQUESTS_DECIDE),
  };
}

/**
 * The page's query: the shared list params plus two of the page's own, a
 * `document` filter and the `request` to open. Neither is an API input.
 */
export const requestPageParamsSchema = documentRequestListParamsSchema.extend({
  document: uuidSchema.optional(),
  request: uuidSchema.optional(),
});

export type RequestPageParams = ReturnType<typeof requestPageParamsSchema.parse>;

export const REQUEST_PAGE_KEYS = [
  "page",
  "pageSize",
  "search",
  "status",
  "document",
  "request",
] as const;

/** The most matches a name or title search narrows the list to. */
const SEARCH_MATCH_LIMIT = 200;

const REQUEST_COLUMNS =
  "id, client_id, document_id, purpose, status, consultation_id, decided_by, granted_at, expires_at, revoked_at, created_at, document:documents(title_ar, title_en, access_mode)";

type RequestRow = {
  id: string;
  client_id: string;
  document_id: string;
  purpose: string;
  status: string;
  consultation_id: string | null;
  decided_by: string | null;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  document: { title_ar: string; title_en: string; access_mode: string } | null;
};

export type RequestDeps = {
  /** The member's own client: RLS decides which requests come back (§7). */
  user?: Client;
  /** Reads names only, for ids the member's own reads returned, and search matches. */
  service?: Client;
};

const iso = (value: string | null) => (value === null ? null : new Date(value).toISOString());

/** Requests with their document, recommendations and names, in the contract's shape. */
async function shape(
  rows: RequestRow[],
  user: Client,
  service: Client,
): Promise<AdminDocumentRequest[]> {
  if (rows.length === 0) return [];
  const { data: recs, error } = await user
    .from("document_recommendations")
    .select("id, request_id, member_id, recommendation, note, created_at")
    .in(
      "request_id",
      rows.map((row) => row.id),
    )
    .order("created_at")
    .order("id");
  if (error) throw new Error(`recommendations read failed: ${error.code}`);
  const names = await profileNames(
    [...rows.map((row) => row.client_id), ...recs.map((rec) => rec.member_id)],
    service,
  );
  const byRequest = new Map<string, AdminDocumentRecommendation[]>();
  for (const rec of recs) {
    const list = byRequest.get(rec.request_id) ?? [];
    list.push({
      id: rec.id,
      memberId: rec.member_id,
      memberName: names.get(rec.member_id) ?? "",
      recommendation: rec.recommendation as AdminDocumentRecommendation["recommendation"],
      note: rec.note,
      createdAt: new Date(rec.created_at).toISOString(),
    });
    byRequest.set(rec.request_id, list);
  }
  // A row the contract can't carry is left out, not sent half-formed.
  return rows.flatMap((row): AdminDocumentRequest[] => {
    const parsed = adminDocumentRequestSchema.safeParse({
      id: row.id,
      clientId: row.client_id,
      clientName: names.get(row.client_id) ?? "",
      documentId: row.document_id,
      // A member without `documents.view` doesn't see the document row.
      documentTitleAr: row.document?.title_ar ?? "",
      documentTitleEn: row.document?.title_en ?? "",
      documentAccessMode: row.document?.access_mode ?? "view",
      purpose: row.purpose,
      status: row.status,
      consultationId: row.consultation_id,
      decidedBy: row.decided_by,
      grantedAt: iso(row.granted_at),
      expiresAt: iso(row.expires_at),
      revokedAt: iso(row.revoked_at),
      createdAt: new Date(row.created_at).toISOString(),
      recommendations: byRequest.get(row.id) ?? [],
    });
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * The client ids and document ids a search term matches: the client's name
 * (service client, clients only) or the document's title (the member's own
 * client, so only documents they may see).
 */
async function searchMatches(
  term: string,
  user: Client,
  service: Client,
): Promise<{ clientIds: string[]; documentIds: string[] }> {
  const pattern = searchPattern(term);
  const [clients, documents] = await Promise.all([
    service
      .from("profiles")
      .select("clerk_user_id")
      .is("role_id", null)
      .or(`full_name.ilike.${pattern}`)
      .limit(SEARCH_MATCH_LIMIT),
    user
      .from("documents")
      .select("id")
      .or(`title_ar.ilike.${pattern},title_en.ilike.${pattern}`)
      .limit(SEARCH_MATCH_LIMIT),
  ]);
  if (clients.error) throw new Error(`client search failed: ${clients.error.code}`);
  if (documents.error) throw new Error(`document search failed: ${documents.error.code}`);
  return {
    clientIds: clients.data.map((row) => row.clerk_user_id),
    documentIds: documents.data.map((row) => row.id),
  };
}

/** A PostgREST `in` list: each value quoted, so ids with odd characters stay values. */
function inList(values: readonly string[]): string {
  return `(${values.map((value) => `"${value.replace(/[\\"]/g, "\\$&")}"`).join(",")})`;
}

/**
 * One page of document requests, newest first, read with the member's own
 * client (RLS: `document_requests.recommend` or `.decide`).
 */
export async function loadRequests(
  params: RequestPageParams,
  deps: RequestDeps = {},
): Promise<AdminDocumentRequestList> {
  const user = deps.user ?? createUserClient();
  const service = deps.service ?? createServiceClient();
  const { from, to } = pageRange(params);

  let match: { clientIds: string[]; documentIds: string[] } | null = null;
  if (params.search) {
    match = await searchMatches(params.search, user, service);
    if (match.clientIds.length === 0 && match.documentIds.length === 0) {
      return { requests: [], total: 0 };
    }
  }

  let query = user.from("document_requests").select(REQUEST_COLUMNS, { count: "exact" });
  if (params.status) query = query.eq("status", params.status);
  if (params.document) query = query.eq("document_id", params.document);
  if (match) {
    const parts = [
      match.clientIds.length > 0 ? `client_id.in.${inList(match.clientIds)}` : null,
      match.documentIds.length > 0 ? `document_id.in.${inList(match.documentIds)}` : null,
    ].filter((part): part is string => part !== null);
    query = query.or(parts.join(","));
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new Error(`document requests read failed: ${error.code}`);
  const requests = await shape(data as RequestRow[], user, service);
  return { requests, total: count ?? requests.length };
}

/** One request, or null when there is none or RLS doesn't show it. */
export async function loadRequest(
  id: string,
  deps: RequestDeps = {},
): Promise<AdminDocumentRequest | null> {
  const user = deps.user ?? createUserClient();
  const service = deps.service ?? createServiceClient();
  const { data, error } = await user
    .from("document_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`document request read failed: ${error.code}`);
  if (!data) return null;
  const [request] = await shape([data as RequestRow], user, service);
  return request ?? null;
}

/** A document the filter offers: id and both titles. */
export type DocumentOption = { id: string; titleAr: string; titleEn: string };

/** The documents the member may see, for the filter. */
export async function loadDocumentOptions(
  user: Client = createUserClient(),
): Promise<DocumentOption[]> {
  const { data, error } = await user
    .from("documents")
    .select("id, title_ar, title_en")
    .order("title_en")
    .order("id");
  if (error) throw new Error(`documents read failed: ${error.code}`);
  return data.map((row) => ({ id: row.id, titleAr: row.title_ar, titleEn: row.title_en }));
}
