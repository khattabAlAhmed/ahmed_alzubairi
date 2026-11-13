import "server-only";
import type { Database } from "@repo/db";
import {
  auditLogEntrySchema,
  pageRange,
  type AdminRole,
  type AdminTeamListResponse,
  type AuditLogEntry,
  type AuditLogList,
  type AuditLogListParams,
  type Locale,
  type TeamListParams,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRoleStore } from "@/lib/admin/roles/store";
import { createTeamClerk } from "@/lib/admin/team/clerk";
import { listTeam } from "@/lib/admin/team/handlers";
import { createTeamStore } from "@/lib/admin/team/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";

/*
 * Every loader here is called only after the page checked `team.manage`. The
 * reads use the member's own client, so RLS checks it again (§9).
 */

/** One page of members and the pending invitations, as `GET /api/admin/team` returns them. */
export async function loadTeam(
  params: TeamListParams,
  locale: Locale,
): Promise<AdminTeamListResponse> {
  const result = await listTeam(params, {
    locale,
    store: createTeamStore(createUserClient(), createServiceClient()),
    clerk: createTeamClerk(),
  });
  if (!("members" in result.body)) throw new Error("team list refused");
  return result.body;
}

/** Every role with its permissions, as `GET /api/admin/roles` returns them. */
export function loadRoles(): Promise<AdminRole[]> {
  return createRoleStore(createUserClient(), createServiceClient()).listRoles();
}

export type Actor = { id: string; name: string };

/** The team members, for the audit log's "who" filter. */
export async function loadActors(
  client: SupabaseClient<Database> = createUserClient(),
): Promise<Actor[]> {
  const { data, error } = await client
    .from("profiles")
    .select("clerk_user_id, full_name")
    .not("role_id", "is", null)
    .order("full_name")
    .limit(100);
  if (error) throw new Error(`actor list failed: ${error.code}`);
  return data.map((row) => ({ id: row.clerk_user_id, name: row.full_name }));
}

export const AUDIT_SELECT =
  "id, actor_id, action, entity, entity_id, metadata, created_at, actor:profiles!audit_log_actor_id_fkey(full_name)";

/** One page of the audit log, newest first. */
export async function loadAudit(
  params: AuditLogListParams,
  client: SupabaseClient<Database> = createUserClient(),
): Promise<AuditLogList> {
  const { from, to } = pageRange(params);
  let query = client.from("audit_log").select(AUDIT_SELECT, { count: "exact" });
  if (params.actor) query = query.eq("actor_id", params.actor);
  if (params.entity) query = query.eq("entity", params.entity);
  if (params.action) query = query.eq("action", params.action);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new Error(`audit list failed: ${error.code}`);

  const entries = data.flatMap((row): AuditLogEntry[] => {
    const metadata =
      typeof row.metadata === "object" && row.metadata !== null && !Array.isArray(row.metadata)
        ? row.metadata
        : {};
    const entry = auditLogEntrySchema.safeParse({
      id: row.id,
      actorId: row.actor_id,
      // Null when RLS doesn't show the actor's profile.
      actorName: row.actor?.full_name ?? null,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      metadata,
      createdAt: new Date(row.created_at).toISOString(),
    });
    return entry.success ? [entry.data] : [];
  });
  return { entries, total: count ?? entries.length };
}
