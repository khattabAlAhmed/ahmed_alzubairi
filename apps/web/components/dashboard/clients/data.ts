import "server-only";
import type { Database } from "@repo/db";
import {
  adminClientSchema,
  LOCALES,
  PERMISSIONS,
  type AdminClient,
  type AdminClientListResponse,
  type ClientListParams,
  type Locale,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantedPermissions } from "@/components/dashboard/access";
import { CLIENT_ACCESS } from "@/components/dashboard/sections";
import { CLIENT_COLUMNS, createClientStore } from "@/lib/admin/clients/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";

export type ClientAccess = {
  locale: Locale;
  /** Any of `CLIENT_ACCESS`: the section opens, and RLS decides the rows. */
  allowed: boolean;
  /** `clients.view_all`: may disable and reactivate (§5). */
  canManage: boolean;
};

/**
 * Who may open the Clients section, decided on the server with
 * `has_permission`. Pages call `requireTeamMember` first, then this, and show
 * `<Refusal />` when `allowed` is false.
 */
export async function clientAccess(
  params: Promise<{ locale: string }>,
  check: typeof grantedPermissions = grantedPermissions,
): Promise<ClientAccess> {
  const { locale: raw } = await params;
  // requireTeamMember already sent unknown locales to "not found".
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  const granted = await check(CLIENT_ACCESS, locale);
  return {
    locale,
    allowed: granted.size > 0,
    canManage: granted.has(PERMISSIONS.CLIENTS_VIEW_ALL),
  };
}

/**
 * One page of clients, read with the member's own client: RLS returns every
 * client for `clients.view_all` and only the scoped ones otherwise (§5).
 */
export function loadClients(params: ClientListParams): Promise<AdminClientListResponse> {
  // The service client is never used for this read; the store takes it for its writes.
  return createClientStore(createUserClient(), createServiceClient()).listClients(params);
}

/**
 * One client's profile, or null when there is no such client or RLS doesn't
 * show it to this member: the page then answers "not found".
 */
export async function loadClient(
  id: string,
  client: SupabaseClient<Database> = createUserClient(),
): Promise<AdminClient | null> {
  const { data, error } = await client
    .from("profiles")
    .select(CLIENT_COLUMNS)
    .eq("clerk_user_id", id)
    .is("role_id", null)
    .maybeSingle();
  if (error) throw new Error(`client read failed: ${error.code}`);
  if (!data) return null;
  const parsed = adminClientSchema.safeParse({
    id: data.clerk_user_id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    orgType: data.org_type,
    orgName: data.org_name,
    jobTitle: data.job_title,
    locale: data.locale,
    status: data.status,
    createdAt: new Date(data.created_at).toISOString(),
  });
  return parsed.success ? parsed.data : null;
}
