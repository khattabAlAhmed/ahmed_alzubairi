import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalStore } from "./handlers";

/** Approval writes through the service client, after the permission check. */
export function createApprovalStore(service: SupabaseClient): ApprovalStore {
  return {
    async getStatus(entity, id) {
      const { data, error } = await service
        .from(entity)
        .select("status")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`${entity} read failed: ${error.code}`);
      return data as { status: string } | null;
    },

    async update(entity, id, columns) {
      const { data, error } = await service
        .from(entity)
        .update({ ...columns, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(`${entity} approval failed: ${error.code}`);
      return (data ?? []).length > 0;
    },

    async audit(entry) {
      const { error } = await service.from("audit_log").insert({
        actor_id: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        metadata: entry.metadata,
      });
      if (error) throw new Error(`audit_log insert failed: ${error.code}`);
    },
  };
}
