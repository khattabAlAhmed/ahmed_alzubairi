import "server-only";
import type { Database } from "@repo/db";
import {
  adminClientSchema,
  pageRange,
  profileStatusSchema,
  type AdminClient,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canOpenDashboard } from "@/lib/auth/profile-access";
import { searchPattern } from "../team/store";
import type { ClientStore } from "./handlers";

type Client = SupabaseClient<Database>;

export const CLIENT_COLUMNS =
  "clerk_user_id, full_name, email, phone, org_type, org_name, job_title, locale, status, created_at";

/** The columns a search term is matched against. */
const SEARCH_COLUMNS = ["full_name", "email", "phone", "org_name"];

/**
 * `user` carries the caller's token, so RLS decides what the reads return
 * (§5, §9): there is no filter by caller here. `service` writes, and only
 * after the route's permission check.
 */
export function createClientStore(user: Client, service: Client): ClientStore {
  return {
    async isActiveMember(userId) {
      // The filter picks the caller's own row out of what RLS shows them.
      const { data, error } = await user
        .from("profiles")
        .select("role_id, status")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`profile read failed: ${error.code}`);
      return canOpenDashboard(data);
    },

    async listClients(params) {
      const { from, to } = pageRange(params);
      let query = user
        .from("profiles")
        .select(CLIENT_COLUMNS, { count: "exact" })
        .is("role_id", null);
      if (params.status) query = query.eq("status", params.status);
      if (params.search) {
        const pattern = searchPattern(params.search);
        query = query.or(
          SEARCH_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(),
        );
      }
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .order("clerk_user_id")
        .range(from, to);
      if (error) throw new Error(`client list failed: ${error.code}`);

      // A row the contract can't carry is left out, not sent half-formed.
      const clients = data.flatMap((row): AdminClient[] => {
        const client = adminClientSchema.safeParse({
          id: row.clerk_user_id,
          fullName: row.full_name,
          email: row.email,
          phone: row.phone,
          orgType: row.org_type,
          orgName: row.org_name,
          jobTitle: row.job_title,
          locale: row.locale,
          status: row.status,
          createdAt: new Date(row.created_at).toISOString(),
        });
        return client.success ? [client.data] : [];
      });
      return { clients, total: count ?? clients.length };
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
        isMember: data.role_id !== null,
        status: profileStatusSchema.parse(data.status),
      };
    },

    async disableClient(id) {
      const { data, error } = await service.rpc("disable_client", {
        client_id: id,
      });
      if (error) throw new Error(`client disable failed: ${error.code}`);
      return data;
    },

    // A compare-and-set, so two requests can't both apply. `role_id is null`:
    // this API never touches a team member.
    async setStatus(id, from, to) {
      const { data, error } = await service
        .from("profiles")
        .update({ status: to })
        .eq("clerk_user_id", id)
        .eq("status", from)
        .is("role_id", null)
        .select("clerk_user_id");
      if (error) throw new Error(`status change failed: ${error.code}`);
      return data.length > 0;
    },
  };
}
