import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  auditLogListParamsSchema,
  PERMISSIONS,
  teamListParamsSchema,
  type AdminRole,
  type Permission,
} from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import contentAr from "@/messages/ar/DashboardContent.json";
import teamAr from "@/messages/ar/DashboardTeam.json";
import contentEn from "@/messages/en/DashboardContent.json";
import teamEn from "@/messages/en/DashboardTeam.json";
import { actionLabel, entityLabel } from "./audit-labels";
import { AUDIT_SELECT, loadActors, loadAudit } from "./data";
import { listPath, pageCount, parseParams } from "./list";
import {
  grantableRoles,
  PERMISSION_LIST,
  permissionLabelKey,
  roleName,
  samePermissions,
  togglePermission,
} from "./permissions";
import { createRole, inviteMember, updateMember, updateRole } from "./send";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const role = (key: string, permissions: Permission[] = []): AdminRole => ({
  id: `${key.length}2345678-1234-4234-8234-123456789012`.slice(0, 36),
  key,
  nameAr: `دور ${key}`,
  nameEn: `Role ${key}`,
  isSystem: key !== "media_officer",
  permissions,
});

/** Reads a dotted message path out of a namespace's JSON. */
function lookup(messages: object, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
}

describe("permission labels", () => {
  it("lists the 14 permissions in the §5 order", () => {
    expect(PERMISSION_LIST).toHaveLength(14);
    expect(PERMISSION_LIST[0]).toBe(PERMISSIONS.CONSULTATIONS_VIEW_ALL);
    expect(PERMISSION_LIST.at(-1)).toBe(PERMISSIONS.TEAM_MANAGE);
  });

  it.each([
    ["Arabic", teamAr],
    ["English", teamEn],
  ])("labels every permission in %s", (_name, messages) => {
    for (const key of PERMISSION_LIST) {
      const label = lookup(messages, permissionLabelKey(key));
      expect(typeof label, key).toBe("string");
      expect((label as string).length).toBeGreaterThan(0);
    }
  });

  it("uses the §5 'what it allows' text", () => {
    expect(lookup(teamEn, permissionLabelKey(PERMISSIONS.CONTENT_MANAGE))).toBe(
      "Edit pages, articles, projects and resources",
    );
  });
});

describe("grantableRoles", () => {
  it("never offers the admin role", () => {
    const roles = [role("admin"), role("content_editor"), role("media_officer")];
    expect(grantableRoles(roles).map((item) => item.key)).toEqual([
      "content_editor",
      "media_officer",
    ]);
  });
});

describe("role helpers", () => {
  it("names a role in the UI language", () => {
    expect(roleName(role("x"), "ar")).toBe("دور x");
    expect(roleName(role("x"), "en")).toBe("Role x");
  });

  it("compares permission sets in any order", () => {
    const a = [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.DOCUMENTS_VIEW];
    expect(samePermissions(a, [...a].reverse())).toBe(true);
    expect(samePermissions(a, [PERMISSIONS.CONTENT_MANAGE])).toBe(false);
    expect(samePermissions(a, [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.TEAM_MANAGE])).toBe(false);
  });

  it("ticks and unticks a permission, keeping the §5 order and no duplicate", () => {
    const start = [PERMISSIONS.TEAM_MANAGE];
    const added = togglePermission(start, PERMISSIONS.CONSULTATIONS_REPLY, true);
    expect(added).toEqual([PERMISSIONS.CONSULTATIONS_REPLY, PERMISSIONS.TEAM_MANAGE]);
    expect(togglePermission(added, PERMISSIONS.CONSULTATIONS_REPLY, true)).toEqual(added);
    expect(togglePermission(added, PERMISSIONS.TEAM_MANAGE, false)).toEqual([
      PERMISSIONS.CONSULTATIONS_REPLY,
    ]);
  });
});

describe("audit labels", () => {
  it.each([
    ["Arabic", teamAr, contentAr],
    ["English", teamEn, contentEn],
  ])("labels every action and entity in %s", (_name, team, content) => {
    for (const action of AUDIT_ACTIONS) {
      expect(actionLabel(action, team.audit.actions), action).not.toBe(action);
    }
    for (const entity of AUDIT_ENTITIES) {
      expect(entityLabel(entity, team.audit.entities, content.types), entity).not.toBe(entity);
    }
  });

  it("shows a stored value it has no label for as stored", () => {
    expect(actionLabel("legacy.thing", teamEn.audit.actions)).toBe("legacy.thing");
    expect(actionLabel("nodot", teamEn.audit.actions)).toBe("nodot");
    expect(entityLabel("old_table", teamEn.audit.entities, contentEn.types)).toBe("old_table");
  });

  it("names content types with the content section's names", () => {
    expect(entityLabel("posts", teamEn.audit.entities, contentEn.types)).toBe("Blog posts");
    expect(entityLabel("roles", teamEn.audit.entities, contentEn.types)).toBe("Roles");
  });
});

describe("list params", () => {
  it("keeps the known values and drops the ones the schema refuses", () => {
    expect(
      parseParams(teamListParamsSchema, ["page", "pageSize", "search", "status"], {
        page: "2",
        status: "banned",
        search: ["acme", "other"],
        roleId: "x",
      }),
    ).toEqual({ page: 2, pageSize: 20, search: "acme" });
  });

  it("reads the audit filters", () => {
    expect(
      parseParams(auditLogListParamsSchema, ["page", "actor", "entity", "action"], {
        actor: "user_abc",
        entity: "roles",
        action: "role.update",
      }),
    ).toMatchObject({ actor: "user_abc", entity: "roles", action: "role.update", page: 1 });
    expect(
      parseParams(auditLogListParamsSchema, ["entity", "action"], {
        entity: "audit_log",
        action: "drop.table",
      }),
    ).toEqual({ page: 1, pageSize: 20 });
  });

  it("builds a link without empty values or defaults", () => {
    expect(listPath("/dashboard/team", { page: 1, pageSize: 20, search: "" })).toBe(
      "/dashboard/team",
    );
    expect(
      listPath("/dashboard/team/audit", { action: "role.update", pageSize: 50, page: 3 }),
    ).toBe("/dashboard/team/audit?action=role.update&pageSize=50&page=3");
  });

  it("counts at least one page", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(41, 20)).toBe(3);
  });
});

describe("send", () => {
  const ok = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));

  it.each([
    ["inviteMember", () => inviteMember({ email: "a@example.com", roleId: role("x").id }, ok), "/api/admin/team", "POST"],
    ["updateMember", () => updateMember({ id: "user_a", status: "disabled" }, ok), "/api/admin/team", "PATCH"],
    ["createRole", () => createRole({ key: "x", nameAr: "س", nameEn: "X", permissions: [] }, ok), "/api/admin/roles", "POST"],
    ["updateRole", () => updateRole({ id: role("x").id, permissions: [] }, ok), "/api/admin/roles", "PATCH"],
  ] as const)("%s calls its route", async (_name, call, url, method) => {
    ok.mockClear();
    expect(await call()).toEqual({ ok: true });
    expect(ok).toHaveBeenCalledWith(url, expect.objectContaining({ method }));
  });

  it("returns the server's localized error text", async () => {
    const refused = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: { code: "forbidden", message: "لا يمكن" } }), {
          status: 403,
        }),
    );
    expect(await updateMember({ id: "user_a", status: "disabled" }, refused)).toEqual({
      ok: false,
      message: "لا يمكن",
    });
  });

  it("returns no text when the network fails or the reply isn't JSON", async () => {
    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError("offline");
    });
    expect(await createRole({ key: "x", nameAr: "س", nameEn: "X", permissions: [] }, down)).toEqual({
      ok: false,
      message: null,
    });
    const html = vi.fn<typeof fetch>(async () => new Response("<html>", { status: 502 }));
    expect(await updateRole({ id: role("x").id, nameEn: "Y" }, html)).toEqual({
      ok: false,
      message: null,
    });
  });
});

describe("loaders", () => {
  /** A supabase-js query that records each call and resolves to `result`. */
  function recorder(result: unknown) {
    const calls: unknown[][] = [];
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    for (const name of ["from", "select", "eq", "not", "order", "range", "limit"]) {
      query[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    }
    return { calls, client: query as never };
  }

  const ROW = {
    id: "323e4567-e89b-42d3-a456-426614174002",
    actor_id: "user_admin",
    action: "role.update",
    entity: "roles",
    entity_id: "423e4567-e89b-42d3-a456-426614174003",
    metadata: { from: ["content.manage"], to: [] },
    created_at: "2026-11-13T10:00:00+00:00",
    actor: { full_name: "Test Admin" },
  };

  it("reads the audit log newest first, one page, with the filters, through the given client", async () => {
    const { calls, client } = recorder({ data: [ROW], error: null, count: 41 });
    const log = await loadAudit(
      { page: 3, pageSize: 20, search: undefined, actor: "user_admin", entity: "roles", action: "role.update" },
      client,
    );
    expect(calls).toEqual([
      ["from", "audit_log"],
      ["select", AUDIT_SELECT, { count: "exact" }],
      ["eq", "actor_id", "user_admin"],
      ["eq", "entity", "roles"],
      ["eq", "action", "role.update"],
      ["order", "created_at", { ascending: false }],
      ["order", "id"],
      ["range", 40, 59],
    ]);
    expect(log).toEqual({
      total: 41,
      entries: [
        {
          id: ROW.id,
          actorId: "user_admin",
          actorName: "Test Admin",
          action: "role.update",
          entity: "roles",
          entityId: ROW.entity_id,
          metadata: { from: ["content.manage"], to: [] },
          createdAt: "2026-11-13T10:00:00.000Z",
        },
      ],
    });
  });

  it("leaves the actor's name empty when RLS hides their profile", async () => {
    const { client } = recorder({
      data: [{ ...ROW, actor: null, metadata: null }],
      error: null,
      count: 1,
    });
    const { entries } = await loadAudit({ page: 1, pageSize: 20, search: undefined }, client);
    expect(entries[0]).toMatchObject({ actorName: null, metadata: {} });
  });

  it("throws on a database error", async () => {
    const { client } = recorder({ data: null, error: { code: "42501" }, count: null });
    await expect(loadAudit({ page: 1, pageSize: 20, search: undefined }, client)).rejects.toThrow("42501");
    await expect(loadActors(client)).rejects.toThrow("42501");
  });

  it("lists team members as the audit log's actors", async () => {
    const { calls, client } = recorder({
      data: [{ clerk_user_id: "user_admin", full_name: "Test Admin" }],
      error: null,
    });
    expect(await loadActors(client)).toEqual([{ id: "user_admin", name: "Test Admin" }]);
    expect(calls).toContainEqual(["not", "role_id", "is", null]);
  });
});
