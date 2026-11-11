import "server-only";
import type { Database } from "@repo/db";
import {
  pageRange,
  profileStatusSchema,
  type AdminTeamMember,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamStore } from "./handlers";

type Client = SupabaseClient<Database>;

const MEMBER_COLUMNS = "clerk_user_id, full_name, email, role_id, status, created_at";

/**
 * A search term as a quoted PostgREST `ilike` value: `%`, `_` and `\` match
 * themselves, and no character can end the value or add a filter.
 */
export function searchPattern(term: string): string {
  const literal = term.replace(/[\\%_]/g, "\\$&");
  return `"%${literal.replace(/[\\"]/g, "\\$&")}%"`;
}

/**
 * `user` carries the caller's token, so RLS decides what the reads return
 * (§9). `service` writes, and only after the route's permission check.
 */
export function createTeamStore(user: Client, service: Client): TeamStore {
  return {
    async listMembers(params) {
      const { from, to } = pageRange(params);
      let query = user
        .from("profiles")
        .select(MEMBER_COLUMNS, { count: "exact" })
        .not("role_id", "is", null);
      if (params.status) query = query.eq("status", params.status);
      if (params.search) {
        const pattern = searchPattern(params.search);
        query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
      }
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .order("clerk_user_id")
        .range(from, to);
      if (error) throw new Error(`team list failed: ${error.code}`);

      const members = data.flatMap((row): AdminTeamMember[] => {
        const status = profileStatusSchema.safeParse(row.status);
        if (row.role_id === null || !status.success) return [];
        return [
          {
            id: row.clerk_user_id,
            fullName: row.full_name,
            email: row.email,
            roleId: row.role_id,
            status: status.data,
            createdAt: new Date(row.created_at).toISOString(),
          },
        ];
      });
      return { members, total: count ?? members.length };
    },

    async getRole(id) {
      const { data, error } = await user
        .from("roles")
        .select("id, key")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`role read failed: ${error.code}`);
      return data;
    },

    async getProfile(id) {
      const { data, error } = await user
        .from("profiles")
        .select("role_id, status")
        .eq("clerk_user_id", id)
        .maybeSingle();
      if (error) throw new Error(`profile read failed: ${error.code}`);
      if (!data) return null;
      return {
        roleId: data.role_id,
        status: profileStatusSchema.parse(data.status),
      };
    },

    // Each write is a compare-and-set, so two requests can't both apply. A
    // client's `role_id` is null and never equals `from`, and the status write
    // says `role_id is not null`: this API never touches a client.
    async setRole(id, from, to) {
      const { data, error } = await service
        .from("profiles")
        .update({ role_id: to })
        .eq("clerk_user_id", id)
        .eq("role_id", from)
        .select("clerk_user_id");
      if (error) throw new Error(`role change failed: ${error.code}`);
      return data.length > 0;
    },

    async setStatus(id, from, to) {
      const { data, error } = await service
        .from("profiles")
        .update({ status: to })
        .eq("clerk_user_id", id)
        .eq("status", from)
        .not("role_id", "is", null)
        .select("clerk_user_id");
      if (error) throw new Error(`status change failed: ${error.code}`);
      return data.length > 0;
    },
  };
}
