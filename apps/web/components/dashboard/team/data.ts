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

type TeamSources = Omit<Parameters<typeof listTeam>[1], "locale">;

/** One page of members and the pending invitations, as `GET /api/admin/team` returns them. */
export async function loadTeam(
  params: TeamListParams,
  locale: Locale,
  sources: TeamSources = {
    store: createTeamStore(createUserClient(), createServiceClient()),
    clerk: createTeamClerk(),
  },
): Promise<AdminTeamListResponse> {
  const load = async (page: TeamListParams) => {
    const result = await listTeam(page, { locale, ...sources });
    if (!("members" in result.body)) throw new Error("team list refused");
    return result.body;
  };
  try {
    return await load(params);
  } catch (error) {
    // PostgREST answers 416 (PGRST103) for a page past the end. The first
    // page gives the total, so the page can send the reader to the last one.
    const pastEnd = error instanceof Error && error.message.endsWith("PGRST103");
    if (!pastEnd || params.page === 1) throw error;
    return { ...(await load({ ...params, page: 1 })), members: [] };
  }
}

/** Every role with its permissions, as `GET /api/admin/roles` returns them. */
export function loadRoles(): Promise<AdminRole[]> {
  return createRoleStore(createUserClient(), createServiceClient()).listRoles();
}

export type Actor = { id: string; name: string };

const ACTOR_PAGE = 1000;

/** Profiles with at least one audit row; `acted` holds one of them at most. */
export const ACTOR_SELECT =
  "clerk_user_id, full_name, acted:audit_log!audit_log_actor_id_fkey!inner(id)";

/**
 * Everyone who appears in the audit log, for its "who" filter: members, past
 * members whose role was taken away, and clients who disabled their own
 * account. Read in pages, so none is cut off. The selected actor is added when
 * they aren't among them, so the filter shows who it filters by.
 */
export async function loadActors(
  selected?: string,
  client: SupabaseClient<Database> = createUserClient(),
): Promise<Actor[]> {
  const actors: Actor[] = [];
  for (let from = 0; ; from += ACTOR_PAGE) {
    const { data, error } = await client
      .from("profiles")
      .select(ACTOR_SELECT)
      .limit(1, { referencedTable: "acted" })
      .order("full_name")
      .order("clerk_user_id")
      .range(from, from + ACTOR_PAGE - 1);
    if (error) throw new Error(`actor list failed: ${error.code}`);
    actors.push(...data.map((row) => ({ id: row.clerk_user_id, name: row.full_name })));
    if (data.length < ACTOR_PAGE) break;
  }
  if (selected && !actors.some((actor) => actor.id === selected)) {
    const { data, error } = await client
      .from("profiles")
      .select("clerk_user_id, full_name")
      .eq("clerk_user_id", selected)
      .maybeSingle();
    if (error) throw new Error(`actor read failed: ${error.code}`);
    actors.push({ id: selected, name: data?.full_name ?? selected });
  }
  return actors;
}

export const AUDIT_SELECT =
  "id, actor_id, action, entity, entity_id, metadata, created_at, actor:profiles!audit_log_actor_id_fkey(full_name)";

/** One page of the audit log, newest first. */
export async function loadAudit(
  params: AuditLogListParams,
  client: SupabaseClient<Database> = createUserClient(),
): Promise<AuditLogList> {
  const { from, to } = pageRange(params);
  const query = (head: boolean) => {
    let built = client
      .from("audit_log")
      .select(AUDIT_SELECT, head ? { count: "exact", head: true } : { count: "exact" });
    if (params.actor) built = built.eq("actor_id", params.actor);
    if (params.entity) built = built.eq("entity", params.entity);
    if (params.action) built = built.eq("action", params.action);
    return built;
  };
  const { data, error, count } = await query(false)
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  // PostgREST answers 416 for a page past the end. Return the count alone, so
  // the page can send the reader to the last page.
  if (error?.code === "PGRST103") {
    const counted = await query(true);
    if (counted.error) throw new Error(`audit count failed: ${counted.error.code}`);
    return { entries: [], total: counted.count ?? 0 };
  }
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
