import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import { writeAudit, type AuditInsert } from "./audit";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ok: AuditInsert = async () => ({ error: null });

describe("writeAudit", () => {
  it("writes the entry as one audit_log row", async () => {
    const insert = vi.fn(ok);
    await writeAudit(
      {
        actorId: "user_admin",
        action: "team.role_change",
        entity: "profiles",
        entityId: "user_member",
        metadata: { from: "role-a", to: "role-b" },
      },
      insert,
    );
    expect(insert).toHaveBeenCalledExactlyOnceWith({
      actor_id: "user_admin",
      action: "team.role_change",
      entity: "profiles",
      entity_id: "user_member",
      metadata: { from: "role-a", to: "role-b" },
    });
  });

  it("writes empty metadata and a null entity id when none is given", async () => {
    const insert = vi.fn(ok);
    await writeAudit(
      { actorId: "user_admin", action: "team.invite", entity: "profiles", entityId: null },
      insert,
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: null, metadata: {} }),
    );
  });

  it("uses actions and entities from the shared lists", async () => {
    const insert = vi.fn(ok);
    await writeAudit(
      { actorId: "user_admin", action: "team.disable", entity: "profiles", entityId: "user_x" },
      insert,
    );
    const row = insert.mock.calls[0]?.[0];
    expect(AUDIT_ACTIONS).toContain(row?.action);
    expect(AUDIT_ENTITIES).toContain(row?.entity);
  });

  it("throws with the database code, never the message, when the insert fails", async () => {
    const insert: AuditInsert = async () => ({
      error: { code: "42501", message: "secret detail" } as { code: string },
    });
    await expect(
      writeAudit(
        { actorId: "user_admin", action: "team.enable", entity: "profiles", entityId: "user_x" },
        insert,
      ),
    ).rejects.toThrow("audit_log insert failed: 42501");
  });
});
