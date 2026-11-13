import {
  PERMISSIONS,
  type AdminClient,
  type ClientListParams,
  type Permission,
  type ProfileStatus,
} from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import adminAr from "@/messages/ar/AdminErrors.json";
import adminEn from "@/messages/en/AdminErrors.json";
import type { AuditEntry } from "../audit";
import { setClerkBan, type ClerkBan } from "./clerk-ban";
import {
  listClients,
  updateClient,
  type ClientDeps,
  type ClientStore,
} from "./handlers";
import { handleClientsRequest, type ClientRouteDeps } from "./route";
import { createClientStore } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ADMIN = "user_admin";
const ASSISTANT = "user_assistant";
const DISABLED_MEMBER = "user_former";
const CLIENT = "user_client";
const OTHER_CLIENT = "user_client_2";
const UNKNOWN = "user_nobody";

type Profile = { isMember: boolean; status: ProfileStatus };

const CLIENT_ROW: AdminClient = {
  id: CLIENT,
  fullName: "Test Client",
  email: "client@example.com",
  phone: "+966500000000",
  orgType: null,
  orgName: null,
  jobTitle: null,
  locale: "ar",
  status: "active",
  createdAt: "2026-11-07T10:00:00.000Z",
};

function world() {
  const profiles = new Map<string, Profile>([
    [ADMIN, { isMember: true, status: "active" }],
    [ASSISTANT, { isMember: true, status: "active" }],
    [DISABLED_MEMBER, { isMember: true, status: "disabled" }],
    [CLIENT, { isMember: false, status: "active" }],
    [OTHER_CLIENT, { isMember: false, status: "disabled" }],
  ]);
  /** Open consultations per client. */
  const open = new Map([[CLIENT, 2]]);
  const banned = new Set<string>([OTHER_CLIENT]);
  /** Every write and Clerk call, in the order they ran. */
  const calls: string[] = [];

  const store = {
    isActiveMember: vi.fn(async (userId: string) => {
      const profile = profiles.get(userId);
      return profile?.isMember === true && profile.status === "active";
    }),
    listClients: vi.fn(async (params: ClientListParams) => {
      void params;
      return { clients: [CLIENT_ROW], total: 1 };
    }),
    getProfile: vi.fn(async (id: string) => {
      const profile = profiles.get(id);
      return profile ? { ...profile } : null;
    }),
    // Like `disable_client`: null for anything that isn't a client.
    disableClient: vi.fn(async (id: string) => {
      calls.push("disable_client");
      const profile = profiles.get(id);
      if (!profile || profile.isMember) return null;
      profile.status = "disabled";
      const closed = open.get(id) ?? 0;
      open.set(id, 0);
      return closed;
    }),
    // Like the real write: compare-and-set, and only a profile with no role.
    setStatus: vi.fn(
      async (id: string, from: ProfileStatus, to: ProfileStatus) => {
        calls.push(`status:${to}`);
        const profile = profiles.get(id);
        if (!profile || profile.isMember || profile.status !== from) {
          return false;
        }
        profile.status = to;
        return true;
      },
    ),
  } satisfies ClientStore;

  const clerk = {
    ban: vi.fn(async (id: string) => {
      calls.push("ban");
      banned.add(id);
    }),
    unban: vi.fn(async (id: string) => {
      calls.push("unban");
      banned.delete(id);
    }),
    isBanned: vi.fn(async (id: string) => banned.has(id)),
  } satisfies ClerkBan;

  const audit = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {});
  const deps = {
    locale: "en",
    userId: ADMIN,
    store,
    clerk,
    audit,
  } satisfies ClientDeps;
  return { profiles, open, banned, calls, store, clerk, audit, deps };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setClerkBan", () => {
  it("bans, and unbans", async () => {
    const { clerk, banned } = world();
    expect(await setClerkBan(CLIENT, true, clerk)).toBe("done");
    expect(banned.has(CLIENT)).toBe(true);
    expect(await setClerkBan(CLIENT, false, clerk)).toBe("done");
    expect(banned.has(CLIENT)).toBe(false);
  });

  it("is refused when the call fails and Clerk says it holds the old state", async () => {
    const { clerk } = world();
    clerk.ban.mockRejectedValueOnce({ status: 500 });
    expect(await setClerkBan(CLIENT, true, clerk)).toBe("refused");
  });

  it("is done when the call fails but Clerk took the change", async () => {
    const { clerk, banned } = world();
    clerk.ban.mockImplementationOnce(async (id) => {
      banned.add(id);
      throw new Error("timeout");
    });
    expect(await setClerkBan(CLIENT, true, clerk)).toBe("done");
  });

  it("is unknown when Clerk can't say what it holds", async () => {
    const { clerk } = world();
    clerk.unban.mockRejectedValueOnce(new Error("down"));
    clerk.isBanned.mockRejectedValueOnce(new Error("down"));
    expect(await setClerkBan(OTHER_CLIENT, false, clerk)).toBe("unknown");
  });

  it("logs the status only, never Clerk's error text", async () => {
    const { clerk } = world();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    clerk.ban.mockRejectedValueOnce({
      status: 422,
      message: "client@example.com",
    });
    await setClerkBan(CLIENT, true, clerk);
    expect(log).toHaveBeenCalledWith("Clerk ban failed", 422);
  });
});

describe("listClients", () => {
  it("returns the clients the store read, with the parsed list params", async () => {
    const { deps, store } = world();
    const result = await listClients(
      { page: "2", pageSize: "10", search: " acme ", status: "active" },
      deps,
    );
    expect(result).toEqual({
      status: 200,
      body: { clients: [CLIENT_ROW], total: 1 },
    });
    expect(store.listClients).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      search: "acme",
      status: "active",
    });
  });

  it("lets a member without clients.view_all ask: RLS scopes the rows", async () => {
    const { deps } = world();
    const result = await listClients({}, { ...deps, userId: ASSISTANT });
    expect(result.status).toBe(200);
  });

  it.each([
    ["a client", CLIENT],
    ["a disabled team member", DISABLED_MEMBER],
    ["a user with no profile", UNKNOWN],
  ])("refuses %s with 403, and reads no client", async (_name, userId) => {
    const { deps, store } = world();
    const result = await listClients({}, { ...deps, userId });
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      error: { code: "forbidden", message: adminEn.forbidden },
    });
    expect(store.listClients).not.toHaveBeenCalled();
  });

  it.each([{ status: "banned" }, { page: "0" }, { role: "admin" }])(
    "answers 400 for the query %o",
    async (query) => {
      const { deps, store } = world();
      expect((await listClients(query, deps)).status).toBe(400);
      expect(store.listClients).not.toHaveBeenCalled();
    },
  );
});

describe("updateClient", () => {
  it("disables: disable_client, then the ban, then the audit row", async () => {
    const { deps, profiles, banned, open, calls, audit } = world();
    const result = await updateClient(
      { id: CLIENT, status: "disabled" },
      deps,
    );
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(calls).toEqual(["disable_client", "ban"]);
    expect(profiles.get(CLIENT)?.status).toBe("disabled");
    expect(banned.has(CLIENT)).toBe(true);
    expect(open.get(CLIENT)).toBe(0);
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "client.disable",
      entity: "profiles",
      entityId: CLIENT,
      metadata: { closedConsultations: 2 },
    });
  });

  it("a failed ban leaves the client active, and audits nothing", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    clerk.ban.mockRejectedValueOnce({ status: 500 });
    const result = await updateClient(
      { id: CLIENT, status: "disabled" },
      deps,
    );
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      error: { code: "internal_error", message: adminEn.clientSyncFailed },
    });
    expect(profiles.get(CLIENT)?.status).toBe("active");
    expect(banned.has(CLIENT)).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it("a ban that reached Clerk although the call failed still disables", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    clerk.ban.mockImplementationOnce(async (id) => {
      banned.add(id);
      throw new Error("timeout");
    });
    const result = await updateClient(
      { id: CLIENT, status: "disabled" },
      deps,
    );
    expect(result.status).toBe(200);
    expect(profiles.get(CLIENT)?.status).toBe("disabled");
    expect(audit).toHaveBeenCalledOnce();
  });

  it("reactivates: the status, then the unban, then the audit row", async () => {
    const { deps, profiles, banned, calls, audit } = world();
    const result = await updateClient(
      { id: OTHER_CLIENT, status: "active" },
      deps,
    );
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(calls).toEqual(["status:active", "unban"]);
    expect(profiles.get(OTHER_CLIENT)?.status).toBe("active");
    expect(banned.has(OTHER_CLIENT)).toBe(false);
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: ADMIN,
      action: "client.enable",
      entity: "profiles",
      entityId: OTHER_CLIENT,
    });
  });

  it("a failed unban leaves the client disabled, and audits nothing", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    clerk.unban.mockRejectedValueOnce({ status: 500 });
    const result = await updateClient(
      { id: OTHER_CLIENT, status: "active" },
      deps,
    );
    expect(result.status).toBe(502);
    expect(profiles.get(OTHER_CLIENT)?.status).toBe("disabled");
    expect(banned.has(OTHER_CLIENT)).toBe(true);
    expect(audit).not.toHaveBeenCalled();
  });

  it("answers 409 when another request reactivated the client first", async () => {
    const { deps, store, clerk, audit } = world();
    store.setStatus.mockResolvedValueOnce(false);
    const result = await updateClient(
      { id: OTHER_CLIENT, status: "active" },
      deps,
    );
    expect(result.status).toBe(409);
    expect(result.body).toEqual({
      error: { code: "conflict", message: adminEn.clientChangedMeanwhile },
    });
    expect(clerk.unban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("sets Clerk to what the profile says when it changed meanwhile", async () => {
    const { deps, profiles, banned, clerk } = world();
    // Someone reactivates the client while the ban is on its way.
    clerk.ban.mockImplementationOnce(async (id) => {
      banned.add(id);
      profiles.get(CLIENT)!.status = "active";
    });
    await updateClient({ id: CLIENT, status: "disabled" }, deps);
    expect(banned.has(CLIENT)).toBe(false);
  });

  it("still sets Clerk to match when the audit insert fails, then throws", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    // Another request reactivates the client while the ban is on its way.
    clerk.ban.mockImplementationOnce(async (id) => {
      banned.add(id);
      profiles.get(CLIENT)!.status = "active";
    });
    audit.mockRejectedValueOnce(new Error("audit_log insert failed: 57014"));
    await expect(updateClient({ id: CLIENT, status: "disabled" }, deps)).rejects.toThrow(
      "audit_log insert failed",
    );
    expect(banned.has(CLIENT)).toBe(false);
  });

  it.each([
    ["an active client", CLIENT, "active", "unban"],
    ["a disabled client", OTHER_CLIENT, "disabled", "ban"],
  ] as const)(
    "a status that %s already has writes nothing and audits nothing, but sets Clerk to match",
    async (_name, id, status, call) => {
      const { deps, calls, audit } = world();
      const result = await updateClient({ id, status }, deps);
      expect(result.status).toBe(200);
      expect(calls).toEqual([call]);
      expect(audit).not.toHaveBeenCalled();
    },
  );

  it("sending the same status again repairs a sign-in left out of step", async () => {
    const { deps, banned, audit } = world();
    // The profile says disabled, but an earlier request left Clerk unbanned.
    banned.delete(OTHER_CLIENT);
    const result = await updateClient({ id: OTHER_CLIENT, status: "disabled" }, deps);
    expect(result.status).toBe(200);
    expect(banned.has(OTHER_CLIENT)).toBe(true);
    expect(audit).not.toHaveBeenCalled();
  });

  it("answers 502 when the repair can't reach Clerk", async () => {
    const { deps, clerk } = world();
    clerk.unban.mockRejectedValueOnce(new Error("down"));
    clerk.isBanned.mockRejectedValueOnce(new Error("down"));
    const result = await updateClient({ id: CLIENT, status: "active" }, deps);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      error: { code: "internal_error", message: adminEn.clientSyncUnconfirmed },
    });
  });

  it("a ban Clerk can't confirm: the status goes back and Clerk is set back too", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    clerk.ban.mockImplementationOnce(async (id) => {
      // The ban lands, but its answer is lost and Clerk can't be asked.
      banned.add(id);
      throw new Error("timeout");
    });
    clerk.isBanned.mockRejectedValueOnce(new Error("down"));
    const result = await updateClient({ id: CLIENT, status: "disabled" }, deps);
    expect(result.status).toBe(502);
    expect(profiles.get(CLIENT)?.status).toBe("active");
    expect(clerk.unban).toHaveBeenCalledWith(CLIENT);
    expect(banned.has(CLIENT)).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it("a refused ban sets the status back without another Clerk call", async () => {
    const { deps, clerk } = world();
    clerk.ban.mockRejectedValueOnce({ status: 500 });
    await updateClient({ id: CLIENT, status: "disabled" }, deps);
    expect(clerk.unban).not.toHaveBeenCalled();
  });

  it("answers 502 when the step that follows another request fails, and keeps the audit row", async () => {
    const { deps, profiles, banned, clerk, audit } = world();
    clerk.ban.mockImplementationOnce(async (id) => {
      banned.add(id);
      profiles.get(CLIENT)!.status = "active";
    });
    clerk.unban.mockRejectedValueOnce({ status: 500 });
    const result = await updateClient({ id: CLIENT, status: "disabled" }, deps);
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      error: { code: "internal_error", message: adminEn.clientSyncUnconfirmed },
    });
    expect(audit).toHaveBeenCalledOnce();
  });

  it.each([
    ["an active team member", ASSISTANT, "disabled"],
    ["a disabled team member", DISABLED_MEMBER, "active"],
    ["the caller", ADMIN, "disabled"],
  ] as const)("refuses %s with 403 and no write", async (_name, id, status) => {
    const { deps, profiles, calls, audit } = world();
    const before = profiles.get(id)?.status;
    const result = await updateClient({ id, status }, deps);
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      error: { code: "forbidden", message: adminEn.clientIsMember },
    });
    expect(profiles.get(id)?.status).toBe(before);
    expect(calls).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it("answers 404 when the profile got a role after the read", async () => {
    const { deps, store, clerk, audit } = world();
    store.disableClient.mockResolvedValueOnce(null);
    const result = await updateClient(
      { id: CLIENT, status: "disabled" },
      deps,
    );
    expect(result.status).toBe(404);
    expect(clerk.ban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("answers 404 for an id with no profile", async () => {
    const { deps, calls } = world();
    const result = await updateClient(
      { id: UNKNOWN, status: "disabled" },
      deps,
    );
    expect(result.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each([
    {},
    { id: CLIENT },
    { id: CLIENT, status: "banned" },
    { id: "", status: "disabled" },
    { id: CLIENT, status: "disabled", roleId: null },
  ])("answers 400 for the body %o", async (body) => {
    const { deps, calls } = world();
    expect((await updateClient(body, deps)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("answers in Arabic for an Arabic caller", async () => {
    const { deps } = world();
    const result = await updateClient(
      { id: ASSISTANT, status: "disabled" },
      { ...deps, locale: "ar" },
    );
    expect(result.body).toEqual({
      error: { code: "forbidden", message: adminAr.clientIsMember },
    });
  });
});

describe("/api/admin/clients", () => {
  const URL = "https://site.example/api/admin/clients";

  /** `granted`: the permissions the database says the caller has. */
  function send(
    userId: string | null,
    method: "GET" | "PATCH",
    { body, granted = [] }: { body?: unknown; granted?: Permission[] } = {},
  ) {
    const state = world();
    const createStore = vi.fn(() => state.store);
    const deps: ClientRouteDeps = {
      getUserId: async () => userId,
      permission: {
        getUserId: async () => userId,
        hasPermission: async (key) => granted.includes(key),
      },
      createStore,
      createClerk: () => state.clerk,
      audit: state.audit,
    };
    const request = new Request(URL, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return handleClientsRequest(request, deps).then((response) => ({
      response,
      createStore,
      ...state,
    }));
  }

  const DISABLE = { id: CLIENT, status: "disabled" };

  it.each([
    ["GET", undefined],
    ["PATCH", DISABLE],
  ] as const)(
    "%s signed out is 401, and nothing is read",
    async (method, body) => {
      const { response, createStore } = await send(null, method, { body });
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthenticated");
      expect(createStore).not.toHaveBeenCalled();
    },
  );

  it("GET as a client is 403", async () => {
    const { response, store } = await send(CLIENT, "GET");
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
    expect(store.listClients).not.toHaveBeenCalled();
  });

  it("GET as an active team member lists the clients", async () => {
    const { response } = await send(ASSISTANT, "GET");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ clients: [CLIENT_ROW], total: 1 });
  });

  it("GET passes the query string to the list", async () => {
    const state = world();
    const request = new Request(`${URL}?page=3&status=disabled`);
    const response = await handleClientsRequest(request, {
      getUserId: async () => ADMIN,
      createStore: () => state.store,
      createClerk: () => state.clerk,
      audit: state.audit,
    });
    expect(response.status).toBe(200);
    expect(state.store.listClients).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, status: "disabled" }),
    );
  });

  it("PATCH without clients.view_all is 403, whatever else the member holds", async () => {
    // Every permission but the one that counts. This member may also see the
    // client through the scoped rule (§5): seeing is not disabling.
    const granted = Object.values(PERMISSIONS).filter(
      (key) => key !== PERMISSIONS.CLIENTS_VIEW_ALL,
    );
    const { response, createStore, profiles, clerk, audit } = await send(
      ASSISTANT,
      "PATCH",
      { body: DISABLE, granted },
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
    expect(createStore).not.toHaveBeenCalled();
    expect(profiles.get(CLIENT)?.status).toBe("active");
    expect(clerk.ban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("PATCH with clients.view_all disables the client as the session's user", async () => {
    const { response, profiles, audit } = await send(ADMIN, "PATCH", {
      body: DISABLE,
      granted: [PERMISSIONS.CLIENTS_VIEW_ALL],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(profiles.get(CLIENT)?.status).toBe("disabled");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ADMIN, action: "client.disable" }),
    );
  });

  it("PATCH on a team member's id is 403", async () => {
    const { response, profiles } = await send(ADMIN, "PATCH", {
      body: { id: ASSISTANT, status: "disabled" },
      granted: [PERMISSIONS.CLIENTS_VIEW_ALL],
    });
    expect(response.status).toBe(403);
    expect(profiles.get(ASSISTANT)?.status).toBe("active");
  });

  it("PATCH with a body that isn't JSON is 400", async () => {
    const state = world();
    const request = new Request(URL, { method: "PATCH", body: "{" });
    const response = await handleClientsRequest(request, {
      getUserId: async () => ADMIN,
      permission: {
        getUserId: async () => ADMIN,
        hasPermission: async () => true,
      },
      createStore: () => state.store,
      createClerk: () => state.clerk,
      audit: state.audit,
    });
    expect(response.status).toBe(400);
  });

  it("a database failure is a 500 with no detail", async () => {
    const state = world();
    state.store.listClients.mockRejectedValueOnce(
      new Error("client list failed: 57014"),
    );
    const response = await handleClientsRequest(new Request(URL), {
      getUserId: async () => ADMIN,
      createStore: () => state.store,
      createClerk: () => state.clerk,
      audit: state.audit,
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("57014");
  });
});

describe("createClientStore", () => {
  /** A supabase-js query that records each call and resolves to `result`. */
  function recorder(result: unknown) {
    const calls: [string, ...unknown[]][] = [];
    const query: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    const methods = [
      "from", "select", "is", "eq", "or", "order", "range", "update",
      "maybeSingle", "rpc",
    ];
    for (const name of methods) {
      query[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    }
    return { calls, client: query as never };
  }

  const ROW = {
    clerk_user_id: CLIENT,
    full_name: "Test Client",
    email: "client@example.com",
    phone: "+966500000000",
    org_type: null,
    org_name: null,
    job_title: null,
    locale: "ar",
    status: "active",
    created_at: "2026-11-07T10:00:00+00:00",
  };
  const PARAMS = { page: 2, pageSize: 10, search: undefined };

  it("lists profiles with no role, newest first, one page, through the user client", async () => {
    const user = recorder({ data: [ROW], error: null, count: 11 });
    const service = recorder({ data: null, error: null });
    const store = createClientStore(user.client, service.client);

    expect(await store.listClients(PARAMS)).toEqual({
      clients: [CLIENT_ROW],
      total: 11,
    });
    expect(user.calls).toEqual([
      ["from", "profiles"],
      ["select", expect.any(String), { count: "exact" }],
      ["is", "role_id", null],
      ["order", "created_at", { ascending: false }],
      ["order", "clerk_user_id"],
      ["range", 10, 19],
    ]);
    // No filter by caller and no service client: RLS scopes the rows.
    expect(service.calls).toEqual([]);
  });

  it("filters by status, and searches name, email, phone and organization", async () => {
    const user = recorder({ data: [], error: null, count: 0 });
    const store = createClientStore(user.client, recorder(null).client);
    await store.listClients({ ...PARAMS, status: "disabled", search: 'a,b"%' });
    expect(user.calls).toContainEqual(["eq", "status", "disabled"]);
    // The term is quoted and escaped: it can't end the value or add a filter.
    const pattern = '"%a,b\\"\\\\%%"';
    expect(user.calls).toContainEqual([
      "or",
      `full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},org_name.ilike.${pattern}`,
    ]);
  });

  it("leaves out a row the contract can't carry", async () => {
    const user = recorder({
      data: [ROW, { ...ROW, clerk_user_id: "user_odd", locale: "fr" }],
      error: null,
      count: 2,
    });
    const store = createClientStore(user.client, recorder(null).client);
    const { clients } = await store.listClients(PARAMS);
    expect(clients.map((client) => client.id)).toEqual([CLIENT]);
  });

  it("disables through disable_client on the service client", async () => {
    const user = recorder(null);
    const service = recorder({ data: 3, error: null });
    const store = createClientStore(user.client, service.client);
    expect(await store.disableClient(CLIENT)).toBe(3);
    expect(service.calls).toEqual([
      ["rpc", "disable_client", { client_id: CLIENT }],
    ]);
    expect(user.calls).toEqual([]);
  });

  it("writes a status only while it is unchanged, and only on a profile with no role", async () => {
    const service = recorder({ data: [], error: null });
    const store = createClientStore(recorder(null).client, service.client);
    expect(await store.setStatus(CLIENT, "disabled", "active")).toBe(false);
    expect(service.calls).toEqual([
      ["from", "profiles"],
      ["update", { status: "active" }],
      ["eq", "clerk_user_id", CLIENT],
      ["eq", "status", "disabled"],
      ["is", "role_id", null],
      ["select", "clerk_user_id"],
    ]);
  });

  it.each([
    ["listClients", (store: ClientStore) => store.listClients(PARAMS)],
    ["getProfile", (store: ClientStore) => store.getProfile(CLIENT)],
    ["isActiveMember", (store: ClientStore) => store.isActiveMember(ADMIN)],
    ["disableClient", (store: ClientStore) => store.disableClient(CLIENT)],
    [
      "setStatus",
      (store: ClientStore) => store.setStatus(CLIENT, "active", "disabled"),
    ],
  ])("%s throws on a database error", async (_name, call) => {
    const failing = { data: null, error: { code: "57014" }, count: null };
    const store = createClientStore(
      recorder(failing).client,
      recorder(failing).client,
    );
    await expect(call(store)).rejects.toThrow("57014");
  });
});
