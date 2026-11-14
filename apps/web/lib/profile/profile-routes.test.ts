import { beforeEach, describe, expect, it, vi } from "vitest";
import profileAr from "@/messages/ar/AccountProfile.json";
import profileEn from "@/messages/en/AccountProfile.json";
import en from "@/messages/en.json";
import type { AuditEntry } from "../admin/audit";
import type { ClerkBan } from "../admin/clients/clerk-ban";
import { disableAccount, type DisableAccountDeps } from "./disable";
import { writeOwnProfile } from "./read";
import { toRow, updateProfile, type ProfileUpdateRow } from "./update";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const USER = "user_client";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateProfile", () => {
  function deps(body: unknown, userId: string | null = USER, found = true) {
    const write = vi.fn<(id: string, row: ProfileUpdateRow) => Promise<boolean>>(async () => found);
    return {
      write,
      run: (locale: "ar" | "en" = "en") =>
        updateProfile({ userId, locale, readBody: async () => body, write }),
    };
  }

  it("refuses a signed-out caller, and writes nothing", async () => {
    const { run, write } = deps({ phone: "+966500000000" }, null);
    const result = await run();
    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      error: { code: "unauthenticated", message: en.Errors.unauthenticated },
    });
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    { fullName: "Someone Else" },
    { name: "Someone Else" },
    { email: "other@example.com" },
    { roleId: "22222222-2222-4222-8222-222222222222" },
    { status: "active" },
    { role_id: null },
    { phone: "+966500000000", status: "active" },
  ])("refuses the unknown field in %o", async (body) => {
    const { run, write } = deps(body);
    expect((await run()).status).toBe(400);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([{}, undefined, { phone: "abc" }, { timezone: "+03:00" }, { locale: "fr" }])(
    "refuses the body %o",
    async (body) => {
      const { run, write } = deps(body);
      expect((await run()).status).toBe(400);
      expect(write).not.toHaveBeenCalled();
    },
  );

  it("writes the sent fields to the caller's own row only", async () => {
    const { run, write } = deps({
      phone: "+966511111111",
      orgType: "company",
      orgName: " Example Co ",
      jobTitle: "Analyst",
      locale: "en",
      timezone: "Europe/London",
      notifyOptional: false,
    });
    expect(await run()).toEqual({ status: 200, body: { ok: true } });
    expect(write).toHaveBeenCalledExactlyOnceWith(USER, {
      phone: "+966511111111",
      org_type: "company",
      org_name: "Example Co",
      job_title: "Analyst",
      locale: "en",
      timezone: "Europe/London",
      notify_optional: false,
    });
  });

  it("answers 404 in the user's language when they have no profile", async () => {
    const { run } = deps({ notifyOptional: true }, USER, false);
    const result = await run("ar");
    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      error: { code: "not_found", message: profileAr.errors.noProfile },
    });
  });

  it("maps only the fields that were sent", () => {
    expect(toRow({ notifyOptional: true })).toEqual({ notify_optional: true });
  });
});

describe("writeOwnProfile", () => {
  it("updates the one row keyed by the session's user", async () => {
    const calls: unknown[][] = [];
    const query: Record<string, unknown> = {};
    for (const name of ["from", "update", "eq"]) {
      query[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return query;
      };
    }
    query.select = async (...args: unknown[]) => {
      calls.push(["select", ...args]);
      return { data: [{ clerk_user_id: USER }], error: null };
    };
    expect(await writeOwnProfile(query as never, USER, { locale: "ar" })).toBe(true);
    expect(calls).toEqual([
      ["from", "profiles"],
      ["update", { locale: "ar" }],
      ["eq", "clerk_user_id", USER],
      ["select", "clerk_user_id"],
    ]);
  });
});

describe("disableAccount", () => {
  function world(profile: { isMember: boolean } | null = { isMember: false }) {
    const calls: string[] = [];
    let status: "active" | "disabled" = "active";
    let banned = false;
    const store = {
      getProfile: vi.fn(async () => (profile ? { ...profile, status } : null)),
      disableClient: vi.fn(async (): Promise<number | null> => {
        calls.push("disable_client");
        if (profile?.isMember) return null;
        status = "disabled";
        return 2;
      }),
      setStatus: vi.fn(async (_id: string, _from: string, to: "active" | "disabled") => {
        calls.push(`status:${to}`);
        status = to;
        return true;
      }),
    };
    const clerk = {
      ban: vi.fn(async () => {
        calls.push("ban");
        banned = true;
      }),
      unban: vi.fn(async () => {
        calls.push("unban");
        banned = false;
      }),
      isBanned: vi.fn(async () => banned),
    } satisfies ClerkBan;
    const audit = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {});
    const run = (overrides: Partial<DisableAccountDeps> = {}) =>
      disableAccount({
        userId: USER,
        locale: "en",
        readBody: async () => ({}),
        store,
        clerk,
        audit,
        ...overrides,
      });
    return { calls, store, clerk, audit, run, state: () => ({ status, banned }) };
  }

  it("refuses a signed-out caller, and touches nothing", async () => {
    const { run, calls, store } = world();
    expect((await run({ userId: null })).status).toBe(401);
    expect(store.getProfile).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("refuses a team member, and touches nothing", async () => {
    const { run, calls, audit } = world({ isMember: true });
    const result = await run();
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      error: { code: "forbidden", message: profileEn.errors.teamMember },
    });
    expect(calls).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it("calls disable_client, then the ban, then writes the audit row", async () => {
    const { run, calls, audit, state } = world();
    expect(await run()).toEqual({ status: 200, body: { ok: true, closedConsultations: 2 } });
    expect(calls).toEqual(["disable_client", "ban"]);
    expect(state()).toEqual({ status: "disabled", banned: true });
    expect(audit).toHaveBeenCalledExactlyOnceWith({
      actorId: USER,
      action: "account.disable",
      entity: "profiles",
      entityId: USER,
      metadata: { closedConsultations: 2 },
    });
  });

  it("unbans when an admin reactivated the profile before the ban landed", async () => {
    const { run, store, clerk, calls, state } = world();
    clerk.ban.mockImplementationOnce(async () => {
      calls.push("ban");
      // The admin's reactivation (status active, unban) finished first.
      await store.setStatus(USER, "disabled", "active");
    });
    expect((await run()).status).toBe(200);
    expect(calls).toEqual(["disable_client", "ban", "status:active", "unban"]);
    expect(state()).toEqual({ status: "active", banned: false });
  });

  it("keeps the ban when the profile can't be read after it", async () => {
    const { run, store, clerk, state } = world();
    store.getProfile.mockImplementationOnce(store.getProfile.getMockImplementation()!);
    store.getProfile.mockRejectedValueOnce(new Error("profile read failed"));
    expect((await run()).status).toBe(200);
    expect(clerk.unban).not.toHaveBeenCalled();
    expect(state()).toEqual({ status: "disabled", banned: true });
  });

  it("a refused ban puts the status back, and audits nothing", async () => {
    const { run, clerk, audit, state } = world();
    clerk.ban.mockRejectedValueOnce({ status: 500 });
    const result = await run();
    expect(result.status).toBe(502);
    expect(result.body).toEqual({
      error: { code: "internal_error", message: profileEn.errors.disableFailed },
    });
    expect(state().status).toBe("active");
    expect(clerk.unban).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("a ban Clerk can't confirm puts the status back and unbans", async () => {
    const { run, clerk, state } = world();
    clerk.ban.mockImplementationOnce(async () => {
      throw new Error("timeout");
    });
    clerk.isBanned.mockRejectedValueOnce(new Error("down"));
    expect((await run()).status).toBe(502);
    expect(state().status).toBe("active");
    expect(clerk.unban).toHaveBeenCalledWith(USER);
  });

  it("after an unknown ban and a failed status write, sets Clerk to what the profile still says", async () => {
    const { run, store, clerk, state } = world();
    clerk.ban.mockImplementationOnce(async () => {
      throw new Error("timeout");
    });
    clerk.isBanned.mockRejectedValueOnce(new Error("down"));
    store.setStatus.mockRejectedValueOnce(new Error("status change failed: 57014"));
    await expect(run()).rejects.toThrow("57014");
    // The profile stayed disabled, so Clerk ends banned too.
    expect(state()).toEqual({ status: "disabled", banned: true });
    expect(clerk.unban).not.toHaveBeenCalled();
  });

  it("leaves Clerk alone when the profile can't be read either", async () => {
    const { run, store, clerk } = world();
    clerk.ban.mockImplementationOnce(async () => {
      throw new Error("timeout");
    });
    clerk.isBanned.mockRejectedValueOnce(new Error("down"));
    store.setStatus.mockRejectedValueOnce(new Error("status change failed: 57014"));
    store.getProfile.mockImplementationOnce(store.getProfile.getMockImplementation()!);
    store.getProfile.mockRejectedValueOnce(new Error("profile read failed"));
    await expect(run()).rejects.toThrow("57014");
    expect(clerk.ban).toHaveBeenCalledTimes(1);
    expect(clerk.unban).not.toHaveBeenCalled();
  });

  it("refuses a profile that got a role meanwhile", async () => {
    const { run, store, clerk } = world();
    store.disableClient.mockResolvedValueOnce(null);
    expect((await run()).status).toBe(403);
    expect(clerk.ban).not.toHaveBeenCalled();
  });

  it("answers 404 when the caller has no profile", async () => {
    const { run, calls } = world(null);
    expect((await run()).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it.each([{ id: "user_other" }, { userId: "user_other" }, undefined])(
    "refuses the body %o",
    async (body) => {
      const { run, calls } = world();
      expect((await run({ readBody: async () => body })).status).toBe(400);
      expect(calls).toEqual([]);
    },
  );
});
