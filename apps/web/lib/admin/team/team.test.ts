import { PERMISSIONS, type Permission, type ProfileStatus } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import adminAr from "@/messages/ar/AdminErrors.json";
import adminEn from "@/messages/en/AdminErrors.json";
import type { AuditEntry } from "../audit";
import type { PermissionDeps } from "../permissions";
import { isExistingAddressError } from "./clerk";
import {
  inviteMember,
  listTeam,
  updateMember,
  type TeamClerk,
  type TeamDeps,
  type TeamStore,
} from "./handlers";
import { handleTeamRequest, type TeamRouteDeps } from "./route";
import { invitedRoleId, isAdminRole, isGrantableRole } from "./rules";
import { searchPattern } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ADMIN = "user_admin";
const OTHER_ADMIN = "user_admin_2";
const MEMBER = "user_member";
const CLIENT = "user_client";

const ADMIN_ROLE = "22222222-2222-4222-8222-222222222222";
const EDITOR_ROLE = "11111111-1111-4111-8111-111111111111";
const TRAINER_ROLE = "44444444-4444-4444-8444-444444444444";
const UNKNOWN_ROLE = "33333333-3333-4333-8333-333333333333";

const ORIGIN = "https://site.example";

type Profile = { roleId: string | null; status: ProfileStatus };

function world() {
  const profiles = new Map<string, Profile>([
    [ADMIN, { roleId: ADMIN_ROLE, status: "active" }],
    [OTHER_ADMIN, { roleId: ADMIN_ROLE, status: "active" }],
    [MEMBER, { roleId: EDITOR_ROLE, status: "active" }],
    [CLIENT, { roleId: null, status: "active" }],
  ]);
  const roles = new Map([
    [ADMIN_ROLE, "admin"],
    [EDITOR_ROLE, "content_editor"],
    [TRAINER_ROLE, "training_coordinator"],
  ]);
  const banned = new Set<string>();

  const store = {
    listMembers: vi.fn(async () => ({
      members: [
        {
          id: MEMBER,
          fullName: "Team Member",
          email: "member@example.com",
          roleId: EDITOR_ROLE,
          status: "active" as const,
          createdAt: "2026-11-07T10:00:00.000Z",
        },
      ],
      total: 1,
    })),
    getRole: vi.fn(async (id: string) => {
      const key = roles.get(id);
      return key ? { id, key } : null;
    }),
    getProfile: vi.fn(async (id: string) => {
      const profile = profiles.get(id);
      return profile ? { ...profile } : null;
    }),
    // Like the real writes: only a profile that has a role.
    setRole: vi.fn(async (id: string, roleId: string) => {
      const profile = profiles.get(id);
      if (!profile || profile.roleId === null) return false;
      profile.roleId = roleId;
      return true;
    }),
    setStatus: vi.fn(async (id: string, status: ProfileStatus) => {
      const profile = profiles.get(id);
      if (!profile || profile.roleId === null) return false;
      profile.status = status;
      return true;
    }),
  } satisfies TeamStore;

  const clerk = {
    listPendingInvitations: vi.fn(async () => [
      {
        email: "invited@example.com",
        publicMetadata: { roleId: EDITOR_ROLE },
        createdAt: Date.parse("2026-11-10T08:00:00.000Z"),
      },
      // Not a team invitation: no role id.
      { email: "other@example.com", publicMetadata: null, createdAt: 0 },
    ]),
    invite: vi.fn(
      async (): Promise<Awaited<ReturnType<TeamClerk["invite"]>>> => ({
        ok: true,
        invitationId: "inv_1",
      }),
    ),
    ban: vi.fn(async (id: string) => {
      banned.add(id);
    }),
    unban: vi.fn(async (id: string) => {
      banned.delete(id);
    }),
  } satisfies TeamClerk;

  const audit = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {});
  const deps = { locale: "en", userId: ADMIN, store, clerk, audit } satisfies TeamDeps;
  return { profiles, banned, store, clerk, audit, deps };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("rules", () => {
  it("a role that exists and isn't admin may be granted", () => {
    expect(isGrantableRole({ id: EDITOR_ROLE, key: "content_editor" })).toBe(true);
    expect(isGrantableRole({ id: ADMIN_ROLE, key: "admin" })).toBe(false);
    expect(isGrantableRole(null)).toBe(false);
  });

  it("only the role with key admin is the admin role", () => {
    expect(isAdminRole({ id: ADMIN_ROLE, key: "admin" })).toBe(true);
    expect(isAdminRole({ id: EDITOR_ROLE, key: "content_editor" })).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it.each([
    [{ roleId: EDITOR_ROLE }, EDITOR_ROLE],
    [{ roleId: "admin" }, null],
    [{ role_id: EDITOR_ROLE }, null],
    [{}, null],
    [null, null],
    ["text", null],
  ])("reads the role id from metadata %j", (metadata, expected) => {
    expect(invitedRoleId(metadata)).toBe(expected);
  });
});

describe("searchPattern", () => {
  it.each([
    ["ahmed", '"%ahmed%"'],
    ["50%", '"%50\\\\%%"'],
    ["a_b", '"%a\\\\_b%"'],
    ['x",email.neq."', '"%x\\",email.neq.\\"%"'],
    ["a,b)", '"%a,b)%"'],
  ])("quotes %j so it can't add a filter", (term, expected) => {
    expect(searchPattern(term)).toBe(expected);
  });
});

describe("isExistingAddressError", () => {
  it.each(["duplicate_record", "form_identifier_exists"])("is true for %s", (code) => {
    expect(isExistingAddressError({ errors: [{ code }] })).toBe(true);
  });

  it.each([
    [{ errors: [{ code: "rate_limit_exceeded" }] }],
    [new Error("network")],
    [null],
  ])("is false for %j", (error) => {
    expect(isExistingAddressError(error)).toBe(false);
  });
});

describe("listTeam", () => {
  it("returns the members and the pending team invitations", async () => {
    const { deps, store } = world();
    const result = await listTeam({ page: "2", pageSize: "10", status: "active" }, deps);
    expect(store.listMembers).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      status: "active",
      search: undefined,
    });
    expect(result).toEqual({
      status: 200,
      body: {
        members: [expect.objectContaining({ id: MEMBER, roleId: EDITOR_ROLE })],
        total: 1,
        invitations: [
          {
            email: "invited@example.com",
            roleId: EDITOR_ROLE,
            createdAt: "2026-11-10T08:00:00.000Z",
          },
        ],
      },
    });
  });

  it.each([{ page: "0" }, { status: "banned" }, { role: "admin" }])(
    "refuses the query %j",
    async (query) => {
      const { deps, store } = world();
      expect((await listTeam(query, deps)).status).toBe(400);
      expect(store.listMembers).not.toHaveBeenCalled();
    },
  );
});

describe("inviteMember", () => {
  const body = { email: "new@example.com", roleId: EDITOR_ROLE };

  it("sends the Clerk invitation with the role id and the sign-up link", async () => {
    const { deps, clerk, audit } = world();
    const result = await inviteMember(body, ORIGIN, deps);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(clerk.invite).toHaveBeenCalledExactlyOnceWith({
      email: "new@example.com",
      roleId: EDITOR_ROLE,
      redirectUrl: `${ORIGIN}/en/sign-up?redirect_url=%2Fen%2Fdashboard`,
    });
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "team.invite",
      entity: "profiles",
      entityId: null,
      metadata: { roleId: EDITOR_ROLE, invitationId: "inv_1" },
    });
  });

  it("keeps the email out of the audit row", async () => {
    const { deps, audit } = world();
    await inviteMember(body, ORIGIN, deps);
    expect(JSON.stringify(audit.mock.calls)).not.toContain("new@example.com");
  });

  it("refuses the admin role: no invitation, no audit row", async () => {
    const { deps, clerk, audit } = world();
    const result = await inviteMember({ ...body, roleId: ADMIN_ROLE }, ORIGIN, deps);
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: adminEn.teamAdminRole } },
    });
    expect(clerk.invite).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses a role that doesn't exist", async () => {
    const { deps, clerk } = world();
    const result = await inviteMember({ ...body, roleId: UNKNOWN_ROLE }, ORIGIN, {
      ...deps,
      locale: "ar",
    });
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: adminAr.teamRoleUnknown } },
    });
    expect(clerk.invite).not.toHaveBeenCalled();
  });

  it("answers 409 when the address already has an account or invitation", async () => {
    const { deps, clerk, audit } = world();
    clerk.invite.mockResolvedValue({ ok: false, reason: "exists" });
    const result = await inviteMember(body, ORIGIN, deps);
    expect(result).toMatchObject({ status: 409, body: { error: { code: "conflict" } } });
    expect(audit).not.toHaveBeenCalled();
  });

  it.each([
    ["a bad email", { email: "nope", roleId: EDITOR_ROLE }],
    ["a role key in place of an id", { email: "new@example.com", roleId: "admin" }],
    ["an extra field", { ...body, status: "active" }],
    ["no body", undefined],
  ])("refuses %s", async (_name, raw) => {
    const { deps, clerk } = world();
    expect((await inviteMember(raw, ORIGIN, deps)).status).toBe(400);
    expect(clerk.invite).not.toHaveBeenCalled();
  });
});

describe("updateMember", () => {
  it("changes a member's role and audits the old and new role ids", async () => {
    const { deps, profiles, audit, clerk } = world();
    const result = await updateMember({ id: MEMBER, roleId: TRAINER_ROLE }, deps);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(profiles.get(MEMBER)?.roleId).toBe(TRAINER_ROLE);
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "team.role_change",
      entity: "profiles",
      entityId: MEMBER,
      metadata: { from: EDITOR_ROLE, to: TRAINER_ROLE },
    });
    expect(clerk.ban).not.toHaveBeenCalled();
  });

  it("refuses a role change to admin and writes nothing", async () => {
    const { deps, profiles, store, audit } = world();
    const result = await updateMember({ id: MEMBER, roleId: ADMIN_ROLE }, deps);
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: adminEn.teamAdminRole } },
    });
    expect(profiles.get(MEMBER)?.roleId).toBe(EDITOR_ROLE);
    expect(store.setRole).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses admin even alongside a disable: neither is applied", async () => {
    const { deps, profiles, clerk } = world();
    const result = await updateMember(
      { id: MEMBER, roleId: ADMIN_ROLE, status: "disabled" },
      deps,
    );
    expect(result.status).toBe(403);
    expect(profiles.get(MEMBER)).toEqual({ roleId: EDITOR_ROLE, status: "active" });
    expect(clerk.ban).not.toHaveBeenCalled();
  });

  it.each([
    ["changing your own role", { id: ADMIN, roleId: EDITOR_ROLE }],
    ["disabling yourself", { id: ADMIN, status: "disabled" }],
  ])("refuses %s", async (_name, body) => {
    const { deps, profiles, store, clerk, audit } = world();
    const result = await updateMember(body, deps);
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: adminEn.teamSelfChange } },
    });
    expect(profiles.get(ADMIN)).toEqual({ roleId: ADMIN_ROLE, status: "active" });
    expect(store.setRole).not.toHaveBeenCalled();
    expect(store.setStatus).not.toHaveBeenCalled();
    expect(clerk.ban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it.each([
    ["a role", { id: CLIENT, roleId: EDITOR_ROLE }],
    ["a disable", { id: CLIENT, status: "disabled" }],
  ])("refuses %s for a client profile", async (_name, body) => {
    const { deps, profiles, clerk, audit } = world();
    const result = await updateMember(body, deps);
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: adminEn.teamNotMember } },
    });
    expect(profiles.get(CLIENT)).toEqual({ roleId: null, status: "active" });
    expect(clerk.ban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it.each([
    ["demoting an admin", { id: OTHER_ADMIN, roleId: EDITOR_ROLE }],
    ["disabling an admin", { id: OTHER_ADMIN, status: "disabled" }],
    [
      "demoting and disabling an admin together",
      { id: OTHER_ADMIN, roleId: EDITOR_ROLE, status: "disabled" },
    ],
  ])("refuses %s: no write, no Clerk call, no audit row", async (_name, body) => {
    const { deps, profiles, store, clerk, audit } = world();
    const result = await updateMember(body, deps);
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: adminEn.teamAdminRole } },
    });
    expect(profiles.get(OTHER_ADMIN)).toEqual({ roleId: ADMIN_ROLE, status: "active" });
    expect(store.setRole).not.toHaveBeenCalled();
    expect(store.setStatus).not.toHaveBeenCalled();
    expect(clerk.ban).not.toHaveBeenCalled();
    expect(clerk.unban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("answers 404 for a profile that doesn't exist", async () => {
    const { deps } = world();
    const result = await updateMember({ id: "user_nobody", status: "disabled" }, deps);
    expect(result).toMatchObject({ status: 404, body: { error: { code: "not_found" } } });
  });

  it("disable sets the status, bans in Clerk and writes the audit row", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    const result = await updateMember({ id: MEMBER, status: "disabled" }, deps);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(profiles.get(MEMBER)?.status).toBe("disabled");
    expect(clerk.ban).toHaveBeenCalledExactlyOnceWith(MEMBER);
    expect(banned.has(MEMBER)).toBe(true);
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "team.disable",
      entity: "profiles",
      entityId: MEMBER,
    });
  });

  it("a failed ban leaves the status unchanged and writes no audit row", async () => {
    const { deps, profiles, clerk, audit } = world();
    clerk.ban.mockRejectedValue(Object.assign(new Error("clerk down"), { status: 503 }));
    const result = await updateMember({ id: MEMBER, status: "disabled" }, deps);
    expect(result).toEqual({
      status: 502,
      body: { error: { code: "internal_error", message: adminEn.teamSyncFailed } },
    });
    expect(profiles.get(MEMBER)?.status).toBe("active");
    expect(audit).not.toHaveBeenCalled();
  });

  it("enable sets the status back, unbans and writes the audit row", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    profiles.set(MEMBER, { roleId: EDITOR_ROLE, status: "disabled" });
    banned.add(MEMBER);
    const result = await updateMember({ id: MEMBER, status: "active" }, deps);
    expect(result.status).toBe(200);
    expect(profiles.get(MEMBER)?.status).toBe("active");
    expect(clerk.unban).toHaveBeenCalledExactlyOnceWith(MEMBER);
    expect(banned.has(MEMBER)).toBe(false);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team.enable", entityId: MEMBER }),
    );
  });

  it("a failed unban leaves the member disabled", async () => {
    const { deps, profiles, clerk, audit } = world();
    profiles.set(MEMBER, { roleId: EDITOR_ROLE, status: "disabled" });
    clerk.unban.mockRejectedValue(new Error("clerk down"));
    const result = await updateMember({ id: MEMBER, status: "active" }, deps);
    expect(result.status).toBe(502);
    expect(profiles.get(MEMBER)?.status).toBe("disabled");
    expect(audit).not.toHaveBeenCalled();
  });

  it("a status or role that is already set changes nothing and audits nothing", async () => {
    const { deps, store, clerk, audit } = world();
    const result = await updateMember(
      { id: MEMBER, status: "active", roleId: EDITOR_ROLE },
      deps,
    );
    expect(result.status).toBe(200);
    expect(store.setStatus).not.toHaveBeenCalled();
    expect(store.setRole).not.toHaveBeenCalled();
    expect(clerk.unban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("applies a role change and a disable together, with one audit row each", async () => {
    const { deps, profiles, audit } = world();
    const result = await updateMember(
      { id: MEMBER, roleId: TRAINER_ROLE, status: "disabled" },
      deps,
    );
    expect(result.status).toBe(200);
    expect(profiles.get(MEMBER)).toEqual({ roleId: TRAINER_ROLE, status: "disabled" });
    expect(audit.mock.calls.map(([entry]) => entry.action)).toEqual([
      "team.disable",
      "team.role_change",
    ]);
  });

  it.each([
    ["only an id", { id: MEMBER }],
    ["an unknown status", { id: MEMBER, status: "banned" }],
    ["an extra field", { id: MEMBER, status: "disabled", email: "x@example.com" }],
    ["no body", undefined],
  ])("refuses %s", async (_name, body) => {
    const { deps, store } = world();
    expect((await updateMember(body, deps)).status).toBe(400);
    expect(store.getProfile).not.toHaveBeenCalled();
  });
});

function routeDeps(userId: string | null, granted: Permission[]) {
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => granted.includes(key),
  };
  const w = world();
  return {
    w,
    deps: {
      permission,
      createStore: vi.fn(() => w.store),
      createClerk: vi.fn(() => w.clerk),
      audit: w.audit,
    } satisfies TeamRouteDeps,
  };
}

function request(method: "GET" | "POST" | "PATCH", body?: unknown, query = "") {
  return new Request(`${ORIGIN}/api/admin/team${query}`, {
    method,
    headers: { referer: `${ORIGIN}/en/dashboard/team` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const REQUESTS = [
  ["GET", undefined],
  ["POST", { email: "new@example.com", roleId: EDITOR_ROLE }],
  ["PATCH", { id: MEMBER, status: "disabled" }],
] as const;

describe("/api/admin/team", () => {
  it.each(REQUESTS)("%s signed out is 401, and nothing is created", async (method, body) => {
    const { deps, w } = routeDeps(null, []);
    const response = await handleTeamRequest(request(method, body), deps);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(deps.createStore).not.toHaveBeenCalled();
    expect(deps.createClerk).not.toHaveBeenCalled();
    expect(w.audit).not.toHaveBeenCalled();
  });

  it.each(REQUESTS)(
    "%s without team.manage is 403, whatever else the member holds",
    async (method, body) => {
      const others = Object.values(PERMISSIONS).filter(
        (key) => key !== PERMISSIONS.TEAM_MANAGE,
      );
      const { deps, w } = routeDeps(MEMBER, others);
      const response = await handleTeamRequest(request(method, body), deps);
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("forbidden");
      expect(deps.createStore).not.toHaveBeenCalled();
      expect(deps.createClerk).not.toHaveBeenCalled();
      expect(w.clerk.ban).not.toHaveBeenCalled();
    },
  );

  it("GET with team.manage lists the team, reading the query string", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleTeamRequest(
      request("GET", undefined, "?search=mem&status=active"),
      deps,
    );
    expect(response.status).toBe(200);
    expect(w.store.listMembers).toHaveBeenCalledWith(
      expect.objectContaining({ search: "mem", status: "active", page: 1 }),
    );
    const body = await response.json();
    expect(body.members).toHaveLength(1);
    expect(body.invitations).toHaveLength(1);
  });

  it("POST with team.manage invites, with a link to this site", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleTeamRequest(
      request("POST", { email: "new@example.com", roleId: EDITOR_ROLE }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(w.clerk.invite).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUrl: `${ORIGIN}/en/sign-up?redirect_url=%2Fen%2Fdashboard`,
      }),
    );
  });

  it("PATCH with team.manage disables the member as the session's user", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleTeamRequest(
      request("PATCH", { id: MEMBER, status: "disabled" }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(w.clerk.ban).toHaveBeenCalledWith(MEMBER);
    expect(w.audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ADMIN, action: "team.disable" }),
    );
  });

  it("a database failure is a 500 with no detail", async () => {
    const { deps, w } = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    w.store.getProfile.mockRejectedValue(new Error("db down"));
    const response = await handleTeamRequest(
      request("PATCH", { id: MEMBER, status: "disabled" }),
      deps,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: expect.not.stringContaining("db down") },
    });
  });
});
