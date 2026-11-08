import "server-only";
import type { ContentType } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbRow } from "./columns";
import type { ContentStore, RowRef, WriteOutcome } from "./handlers";

// Postgres error codes.
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * What each read asks for. Reads go through the user's client, and Postgres
 * refuses a whole select that names a column outside the user's grant, so a
 * table granted column by column needs an explicit list, never `*`.
 *
 * - `resources`: authenticated never reads `storage_key` (§9,
 *   `20261107031900_storage.sql`). `columns.ts` strips it from API rows too.
 * - `projects`: the row with its images and linked services.
 */
export const SELECT: Partial<Record<ContentType, string>> = {
  projects: "*, project_images(path, alt_ar, alt_en, position), project_services(service_id)",
  resources:
    "id, expertise_id, kind, title_ar, title_en, description_ar, description_en, access, status, created_at, updated_at",
};

/** The select for a type's reads: its list above, else every column. */
export function selectFor(type: ContentType): string {
  return SELECT[type] ?? "*";
}

/** Dashboard order: by position where the table has one, else newest first. */
const ORDER: Record<ContentType, { column: string; ascending: boolean }> = {
  home_sections: { column: "position", ascending: true },
  home_stats: { column: "position", ascending: true },
  pages: { column: "key", ascending: true },
  timeline_items: { column: "position", ascending: true },
  expertise_areas: { column: "position", ascending: true },
  services: { column: "position", ascending: true },
  projects: { column: "created_at", ascending: false },
  faqs: { column: "position", ascending: true },
  partners: { column: "position", ascending: true },
  testimonials: { column: "position", ascending: true },
  posts: { column: "created_at", ascending: false },
  resources: { column: "created_at", ascending: false },
  media_items: { column: "created_at", ascending: false },
};

type PostgrestError = { code: string } | null;

function failure(error: PostgrestError, what: string): WriteOutcome {
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, reason: "conflict" };
  if (error?.code === FOREIGN_KEY_VIOLATION) {
    return { ok: false, reason: "invalid_reference" };
  }
  throw new Error(`${what} failed: ${error?.code ?? "unknown"}`);
}

function idOf(row: DbRow, ref?: RowRef): string {
  return String(ref ? row[ref.column] : row.id);
}

/**
 * The content tables through supabase-js. The table name comes from the parsed
 * `:type`, so the clients are used without their generated table types here;
 * the shared schemas have already checked every column.
 *
 * @param user The user's client: RLS lets `content.manage` read these tables.
 * @param service The service client, created by the route after the permission check.
 */
export function createContentStore(
  user: SupabaseClient,
  service: SupabaseClient,
): ContentStore {
  return {
    async list(type) {
      const order = ORDER[type];
      const { data, error } = await user
        .from(type)
        .select(selectFor(type))
        .order(order.column, { ascending: order.ascending });
      if (error) throw new Error(`${type} list failed: ${error.code}`);
      return (data ?? []) as unknown as DbRow[];
    },

    async get(type, ref) {
      const { data, error } = await user
        .from(type)
        .select(selectFor(type))
        .eq(ref.column, ref.value)
        .maybeSingle();
      if (error) throw new Error(`${type} read failed: ${error.code}`);
      return (data as unknown as DbRow | null) ?? null;
    },

    async insert(type, columns) {
      const { data, error } = await service
        .from(type)
        .insert(columns)
        .select("id")
        .single();
      if (error || !data) return failure(error, `${type} insert`);
      return { ok: true, id: idOf(data as DbRow) };
    },

    async update(type, ref, columns) {
      // An update with no columns (only images or services changed) still
      // touches the row, so `updated_at` moves and the row must exist.
      const { data, error } = await service
        .from(type)
        .update(Object.keys(columns).length > 0 ? columns : { [ref.column]: ref.value })
        .eq(ref.column, ref.value)
        .select(ref.column);
      if (error) return failure(error, `${type} update`);
      if (!data || data.length === 0) return { ok: false, reason: "not_found" };
      return { ok: true, id: idOf(data[0] as DbRow, ref) };
    },

    async replaceProjectImages(projectId, rows) {
      // Add the new images before removing the old ones, so a failed insert
      // leaves the project with its previous images, never with none.
      const before = await service
        .from("project_images")
        .select("id")
        .eq("project_id", projectId);
      if (before.error) {
        throw new Error(`project_images read failed: ${before.error.code}`);
      }
      if (rows.length > 0) {
        const added = await service.from("project_images").insert(rows);
        if (added.error) {
          throw new Error(`project_images insert failed: ${added.error.code}`);
        }
      }
      const oldIds = (before.data ?? []).map((row) => String(row.id));
      if (oldIds.length === 0) return;
      const removed = await service
        .from("project_images")
        .delete()
        .in("id", oldIds);
      if (removed.error) {
        throw new Error(`project_images delete failed: ${removed.error.code}`);
      }
    },

    async replaceProjectServices(projectId, serviceIds) {
      const removed = await service
        .from("project_services")
        .delete()
        .eq("project_id", projectId);
      if (removed.error) return failure(removed.error, "project_services delete");
      if (serviceIds.length > 0) {
        const added = await service.from("project_services").insert(
          [...new Set(serviceIds)].map((serviceId) => ({
            project_id: projectId,
            service_id: serviceId,
          })),
        );
        if (added.error) return failure(added.error, "project_services insert");
      }
      return { ok: true, id: projectId };
    },

    async servicesExist(serviceIds) {
      const { count, error } = await service
        .from("services")
        .select("id", { count: "exact", head: true })
        .in("id", [...serviceIds]);
      if (error) throw new Error(`services read failed: ${error.code}`);
      return count === serviceIds.length;
    },

    async remove(type, id) {
      const { error } = await service.from(type).delete().eq("id", id);
      if (error) throw new Error(`${type} delete failed: ${error.code}`);
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
