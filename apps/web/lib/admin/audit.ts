import "server-only";
import type { Json } from "@repo/db";
import type { AuditAction, AuditEntity } from "@repo/shared";
import { createServiceClient } from "@/lib/supabase/service";

export type AuditEntry = {
  /** The acting user, from the session. */
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  /** The row the action touched, or null when there is no row yet. */
  entityId: string | null;
  /** Ids and flags only. Never a name, an email, a phone or message text. */
  metadata?: { [key: string]: Json };
};

/** The one insert `writeAudit` makes, so tests can replace the database. */
export type AuditInsert = (row: {
  actor_id: string;
  action: AuditAction;
  entity: AuditEntity;
  entity_id: string | null;
  metadata: { [key: string]: Json };
}) => PromiseLike<{ error: { code?: string } | null }>;

const defaultInsert: AuditInsert = (row) =>
  createServiceClient().from("audit_log").insert(row);

/**
 * Adds one `audit_log` row with the service client. Call it only on the
 * server, after the route has checked identity and permission. It throws when
 * the row can't be written, so the caller's request fails loudly.
 */
export async function writeAudit(
  entry: AuditEntry,
  insert: AuditInsert = defaultInsert,
): Promise<void> {
  const { error } = await insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    metadata: entry.metadata ?? {},
  });
  if (error) throw new Error(`audit_log insert failed: ${error.code}`);
}
