import "server-only";
import type { Database } from "@repo/db";
import {
  adminDocumentSchema,
  documentOpenActionSchema,
  LOCALES,
  PERMISSIONS,
  type AdminDocument,
  type DocumentOpenAction,
  type Locale,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantedPermissions } from "@/components/dashboard/access";
import { createDocumentStore } from "@/lib/admin/documents/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";

type Client = SupabaseClient<Database>;

export type DocumentsAccess = {
  locale: Locale;
  /** `documents.manage`: the section opens. */
  allowed: boolean;
  /** `data.delete`: the delete control shows. The route checks it again. */
  canDelete: boolean;
  /** `document_requests.decide`: RLS lets the access log through. */
  canSeeLog: boolean;
};

const DOCUMENTS_KEYS = [
  PERMISSIONS.DOCUMENTS_MANAGE,
  PERMISSIONS.DATA_DELETE,
  PERMISSIONS.DOCUMENT_REQUESTS_DECIDE,
];

/**
 * Who may open the Documents section, decided on the server with
 * `has_permission`. Pages call `requireTeamMember` first, then this, and show
 * `<Refusal />` when `allowed` is false.
 */
export async function documentsAccess(
  params: Promise<{ locale: string }>,
  check: typeof grantedPermissions = grantedPermissions,
): Promise<DocumentsAccess> {
  const { locale: raw } = await params;
  // requireTeamMember already sent unknown locales to "not found".
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  const granted = await check(DOCUMENTS_KEYS, locale);
  return {
    locale,
    allowed: granted.has(PERMISSIONS.DOCUMENTS_MANAGE),
    canDelete: granted.has(PERMISSIONS.DATA_DELETE),
    canSeeLog: granted.has(PERMISSIONS.DOCUMENT_REQUESTS_DECIDE),
  };
}

/** Every document, read with the member's own client. Never a storage key. */
export function loadDocuments(): Promise<AdminDocument[]> {
  // The service client is never used for this read; the store takes it for its writes.
  return createDocumentStore(createUserClient(), createServiceClient()).list();
}

/** One document, or null when there is none or RLS doesn't show it. */
export async function loadDocument(
  id: string,
  client: Client = createUserClient(),
): Promise<AdminDocument | null> {
  const { data, error } = await client
    .from("documents")
    .select("id, category, title_ar, title_en, mime, access_mode, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`document read failed: ${error.code}`);
  if (!data) return null;
  const parsed = adminDocumentSchema.safeParse({
    id: data.id,
    category: data.category,
    titleAr: data.title_ar,
    titleEn: data.title_en,
    mime: data.mime,
    accessMode: data.access_mode,
    status: data.status,
  });
  return parsed.success ? parsed.data : null;
}

/** One open of a protected document: who, when, view or download (§6.18). */
export type AccessLogEntry = {
  id: string;
  requestId: string;
  documentId: string;
  clientId: string;
  clientName: string;
  action: DocumentOpenAction;
  createdAt: string;
};

/** The most entries one log shows, newest first. */
export const ACCESS_LOG_LIMIT = 100;

/**
 * `full_name` by user id, for ids the member's own reads already returned.
 * The service client is used because a member who may see a request may not
 * see its client's profile (§5); the page checked the permission first.
 */
export async function profileNames(
  ids: readonly string[],
  service: Client = createServiceClient(),
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return names;
  const { data, error } = await service
    .from("profiles")
    .select("clerk_user_id, full_name")
    .in("clerk_user_id", unique);
  if (error) throw new Error(`profile names read failed: ${error.code}`);
  for (const row of data) names.set(row.clerk_user_id, row.full_name);
  return names;
}

/**
 * The access log for one document or one request, newest first, read with
 * the member's own client: RLS lets it through only with
 * `document_requests.decide`. Callers check that permission first.
 */
export async function loadAccessLog(
  filter: { documentId: string } | { requestId: string },
  deps: { user?: Client; names?: (ids: readonly string[]) => Promise<Map<string, string>> } = {},
): Promise<AccessLogEntry[]> {
  const user = deps.user ?? createUserClient();
  const names = deps.names ?? ((ids) => profileNames(ids));
  let query = user
    .from("document_access_log")
    .select("id, request_id, document_id, client_id, action, created_at");
  query =
    "documentId" in filter
      ? query.eq("document_id", filter.documentId)
      : query.eq("request_id", filter.requestId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .limit(ACCESS_LOG_LIMIT);
  if (error) throw new Error(`access log read failed: ${error.code}`);
  const byId = await names(data.map((row) => row.client_id));
  return data.flatMap((row): AccessLogEntry[] => {
    const action = documentOpenActionSchema.safeParse(row.action);
    if (!action.success) return [];
    return [
      {
        id: row.id,
        requestId: row.request_id,
        documentId: row.document_id,
        clientId: row.client_id,
        clientName: byId.get(row.client_id) ?? "",
        action: action.data,
        createdAt: new Date(row.created_at).toISOString(),
      },
    ];
  });
}
