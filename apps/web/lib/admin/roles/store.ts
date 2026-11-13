import "server-only";
import type { Database } from "@repo/db";
import { PERMISSIONS, type AdminRole, type Permission } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleStore } from "./handlers";

type Client = SupabaseClient<Database>;

export const ROLE_SELECT =
  "id, key, name_ar, name_en, is_system, role_permissions(permission)";

type RoleRow = {
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  is_system: boolean;
  role_permissions: { permission: string }[];
};

const KNOWN = new Set<string>(Object.values(PERMISSIONS));

/** Postgres: a unique constraint refused the row. */
const UNIQUE_VIOLATION = "23505";

/** A stored key that `PERMISSIONS` no longer names is left out. */
function adminRole(row: RoleRow): AdminRole {
  return {
    id: row.id,
    key: row.key,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    isSystem: row.is_system,
    permissions: row.role_permissions
      .map((item) => item.permission)
      .filter((key): key is Permission => KNOWN.has(key))
      .sort(),
  };
}

/**
 * `user` carries the caller's token, so RLS decides what the reads return
 * (§9). `service` writes, and only after the route's permission check.
 */
export function createRoleStore(user: Client, service: Client): RoleStore {
  /** `set_role_permissions`: one transaction, under a lock on the role. */
  async function setRole(
    id: string,
    changes: Parameters<RoleStore["updateRole"]>[1],
  ): Promise<boolean> {
    const { data, error } = await service.rpc("set_role_permissions", {
      role_id: id,
      name_ar: changes.nameAr,
      name_en: changes.nameEn,
      permissions: changes.permissions,
    });
    if (error) throw new Error(`role update failed: ${error.code}`);
    return data === "updated";
  }

  return {
    async listRoles() {
      const { data, error } = await user
        .from("roles")
        .select(ROLE_SELECT)
        .order("is_system", { ascending: false })
        .order("key");
      if (error) throw new Error(`role list failed: ${error.code}`);
      return data.map(adminRole);
    },

    async getRole(id) {
      const { data, error } = await user
        .from("roles")
        .select(ROLE_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`role read failed: ${error.code}`);
      return data ? adminRole(data) : null;
    },

    async createRole(input) {
      const { data, error } = await service
        .from("roles")
        .insert({ key: input.key, name_ar: input.nameAr, name_en: input.nameEn })
        .select("id")
        .single();
      if (error?.code === UNIQUE_VIOLATION) {
        return { ok: false, reason: "key_taken" };
      }
      if (error) throw new Error(`role insert failed: ${error.code}`);

      // No member holds the new role yet, so nobody can see it without its
      // permissions. If they can't be written, the role is removed again, so
      // the same request can be sent a second time.
      try {
        if (!(await setRole(data.id, { permissions: input.permissions }))) {
          throw new Error("role update failed: no role");
        }
      } catch (failure) {
        await service.from("roles").delete().eq("id", data.id);
        throw failure;
      }
      return { ok: true, id: data.id };
    },

    updateRole: setRole,
  };
}
