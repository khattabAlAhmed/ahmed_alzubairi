import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@repo/db";
import {
  consultationListParamsSchema,
  LOCALES,
  pageRange,
  PERMISSIONS,
  uuidSchema,
  type Consultation,
  type ConsultationDetailResponse,
  type Locale,
  type Permission,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantedPermissions } from "@/components/dashboard/access";
import { profileNames } from "@/components/dashboard/documents/data";
import { readConsultation } from "@/lib/consultations/handlers";
import { createConsultationStore } from "@/lib/consultations/store";
import { searchPattern } from "@/lib/admin/team/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import type { Assignee } from "./types";

type Client = SupabaseClient<Database>;

export type ConsultationsAccess = {
  locale: Locale;
  userId: string;
  /** `consultations.view_all` or `consultations.reply`: the section opens. */
  allowed: boolean;
  viewAll: boolean;
  reply: boolean;
  assign: boolean;
  delete: boolean;
};

const ACCESS_KEYS: Permission[] = [
  PERMISSIONS.CONSULTATIONS_VIEW_ALL,
  PERMISSIONS.CONSULTATIONS_REPLY,
  PERMISSIONS.CONSULTATIONS_ASSIGN,
  PERMISSIONS.DATA_DELETE,
];

/**
 * What the member may do here, decided on the server with `has_permission`.
 * Pages call `requireTeamMember` first, then this, and show `<Refusal />`
 * when `allowed` is false. Never a role name.
 */
export async function consultationsAccess(
  params: Promise<{ locale: string }>,
  check: typeof grantedPermissions = grantedPermissions,
  session: () => Promise<{ userId: string | null }> = auth,
): Promise<ConsultationsAccess> {
  const { locale: raw } = await params;
  // requireTeamMember already sent unknown locales to "not found".
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  const [granted, { userId }] = await Promise.all([check(ACCESS_KEYS, locale), session()]);
  const viewAll = granted.has(PERMISSIONS.CONSULTATIONS_VIEW_ALL);
  const reply = granted.has(PERMISSIONS.CONSULTATIONS_REPLY);
  return {
    locale,
    userId: userId ?? "",
    allowed: Boolean(userId) && (viewAll || reply),
    viewAll,
    reply,
    assign: granted.has(PERMISSIONS.CONSULTATIONS_ASSIGN),
    delete: granted.has(PERMISSIONS.DATA_DELETE),
  };
}

/**
 * What the member may do on one consultation, mirroring the API's rules
 * (§8): work on it (status, close, meetings, replies) with `view_all`, or with
 * `reply` when it is assigned to them. The API checks again.
 */
export function mayWorkOn(access: ConsultationsAccess, consultation: Pick<Consultation, "assignedTo">): boolean {
  return access.viewAll || (access.reply && consultation.assignedTo === access.userId);
}

/** The shared list params' keys. `mine` is the page's own, read by `pageParams`. */
export const CONSULTATION_LIST_KEYS = ["page", "pageSize", "search", "status", "kind"] as const;

export type ConsultationPageParams = ReturnType<typeof consultationListParamsSchema.parse> & {
  /** Only the ones assigned to the member. */
  mine?: true;
};

/** `?mine=1` adds "assigned to me"; anything else is ignored. */
export function withMine(
  params: ReturnType<typeof consultationListParamsSchema.parse>,
  raw: Record<string, string | string[] | undefined>,
): ConsultationPageParams {
  const value = Array.isArray(raw.mine) ? raw.mine[0] : raw.mine;
  return value === "1" ? { ...params, mine: true } : params;
}

export type ConsultationListRow = Consultation & { clientName: string; assigneeName: string | null };

const COLUMNS =
  "id, kind, client_id, service_id, title, description, organization, status, assigned_to, first_reply_at, closed_at, created_at";

type Row = {
  id: string;
  kind: string;
  client_id: string;
  service_id: string | null;
  title: string;
  description: string;
  organization: string | null;
  status: string;
  assigned_to: string | null;
  first_reply_at: string | null;
  closed_at: string | null;
  created_at: string;
};

const iso = (value: string | null) => (value === null ? null : new Date(value).toISOString());

function toConsultation(row: Row): Consultation {
  return {
    id: row.id,
    kind: row.kind as Consultation["kind"],
    clientId: row.client_id,
    serviceId: row.service_id,
    title: row.title,
    description: row.description,
    organization: row.organization,
    status: row.status as Consultation["status"],
    assignedTo: row.assigned_to,
    firstReplyAt: iso(row.first_reply_at),
    closedAt: iso(row.closed_at),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export type ListDeps = { user?: Client; service?: Client };

/**
 * One page of consultations, newest first, through the member's own client:
 * RLS shows every one with `view_all`, the assigned ones with `reply` (§7).
 * Names are read with the service client, only for the ids RLS returned.
 */
export async function loadConsultations(
  params: ConsultationPageParams,
  userId: string,
  { user = createUserClient(), service = createServiceClient() }: ListDeps = {},
): Promise<{ consultations: ConsultationListRow[]; total: number }> {
  const { from, to } = pageRange(params);
  let query = user.from("consultations").select(COLUMNS, { count: "exact" });
  if (params.status) query = query.eq("status", params.status);
  if (params.kind) query = query.eq("kind", params.kind);
  if (params.mine) query = query.eq("assigned_to", userId);
  if (params.search) query = query.or(`title.ilike.${searchPattern(params.search)}`);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new Error(`consultation list failed: ${error.code}`);
  const rows = (data as Row[]).map(toConsultation);
  const names = await profileNames(
    rows.flatMap((row) => [row.clientId, ...(row.assignedTo ? [row.assignedTo] : [])]),
    service,
  );
  return {
    consultations: rows.map((row) => ({
      ...row,
      clientName: names.get(row.clientId) ?? "",
      assigneeName: row.assignedTo ? (names.get(row.assignedTo) ?? "") : null,
    })),
    total: count ?? rows.length,
  };
}

export type ClientContact = {
  name: string;
  email: string | null;
  phone: string | null;
  orgName: string | null;
};

export type { Assignee } from "./types";

export type ConsultationView = ConsultationDetailResponse & {
  client: ClientContact;
  assigneeName: string | null;
  /** The document request this consultation came from, when RLS shows it. */
  documentRequestId: string | null;
};

/**
 * One consultation as the member sees it, or null when RLS hides it. The
 * client's contact comes from the member's own client, so only what RLS
 * allows; without it, just the name.
 */
export async function loadConsultation(
  id: string,
  userId: string,
  locale: Locale,
  { user = createUserClient(), service = createServiceClient() }: ListDeps = {},
): Promise<ConsultationView | null> {
  if (!uuidSchema.safeParse(id).success) return null;
  const result = await readConsultation(id, {
    locale,
    userId,
    store: createConsultationStore(user, service),
  });
  if (result.status === 404) return null;
  if (result.status !== 200 || "error" in result.body) throw new Error(`consultation read failed: ${result.status}`);
  const detail = result.body;
  const { clientId, assignedTo } = detail.consultation;

  const [contact, names, request] = await Promise.all([
    user.from("profiles").select("full_name, email, phone, org_name").eq("clerk_user_id", clientId).maybeSingle(),
    profileNames([clientId, ...(assignedTo ? [assignedTo] : [])], service),
    detail.consultation.kind === "document_request"
      ? user.from("document_requests").select("id").eq("consultation_id", id).limit(1)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ]);
  if (contact.error) throw new Error(`client contact read failed: ${contact.error.code}`);
  if (request.error) throw new Error(`document request read failed: ${request.error.code}`);

  return {
    ...detail,
    client: {
      name: contact.data?.full_name ?? names.get(clientId) ?? "",
      email: contact.data?.email ?? null,
      phone: contact.data?.phone ?? null,
      orgName: contact.data?.org_name ?? null,
    },
    assigneeName: assignedTo ? (names.get(assignedTo) ?? "") : null,
    documentRequestId: request.data?.[0]?.id ?? null,
  };
}

/**
 * Active members whose role holds `consultations.reply`: who may be assigned.
 * Service client: call it only after the page checked `consultations.assign`.
 */
export async function loadAssignees(service: Client = createServiceClient()): Promise<Assignee[]> {
  const roles = await service
    .from("role_permissions")
    .select("role_id")
    .eq("permission", PERMISSIONS.CONSULTATIONS_REPLY);
  if (roles.error) throw new Error(`assignee roles read failed: ${roles.error.code}`);
  const roleIds = [...new Set(roles.data.map((row) => row.role_id))];
  if (roleIds.length === 0) return [];
  const { data, error } = await service
    .from("profiles")
    .select("clerk_user_id, full_name")
    .in("role_id", roleIds)
    .eq("status", "active")
    .order("full_name");
  if (error) throw new Error(`assignees read failed: ${error.code}`);
  return data.map((row) => ({ id: row.clerk_user_id, name: row.full_name }));
}
