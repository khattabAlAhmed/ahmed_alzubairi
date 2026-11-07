import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SettingsStore } from "./handlers";

/** Settings writes through the service client, after the permission check. */
export function createSettingsStore(service: SupabaseClient): SettingsStore {
  return {
    async upsert(key, value) {
      const { error } = await service
        .from("site_settings")
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw new Error(`site_settings upsert failed: ${error.code}`);
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
