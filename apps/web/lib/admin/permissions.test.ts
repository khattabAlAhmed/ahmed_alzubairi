import { PERMISSIONS, errorResponseSchema, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import adminAr from "@/messages/ar/AdminErrors.json";
import adminEn from "@/messages/en/AdminErrors.json";
import ar from "@/messages/ar.json";
import { requirePermission, type PermissionDeps } from "./permissions";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));

function deps(userId: string | null, granted: Permission[]) {
  return {
    getUserId: vi.fn(async () => userId),
    hasPermission: vi.fn(async (key: Permission) => granted.includes(key)),
  } satisfies PermissionDeps;
}

describe("requirePermission", () => {
  it("refuses a signed-out request with 401, before asking the database", async () => {
    const d = deps(null, [PERMISSIONS.CONTENT_MANAGE]);
    const result = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
      locale: "ar",
      deps: d,
    });
    expect(result).toEqual({
      ok: false,
      status: 401,
      body: {
        error: { code: "unauthenticated", message: ar.Errors.unauthenticated },
      },
    });
    expect(d.hasPermission).not.toHaveBeenCalled();
  });

  it("refuses a user without the permission with 403", async () => {
    const d = deps("user_1", [PERMISSIONS.DOCUMENTS_VIEW]);
    const result = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
      locale: "en",
      deps: d,
    });
    expect(result).toEqual({
      ok: false,
      status: 403,
      body: { error: { code: "forbidden", message: adminEn.forbidden } },
    });
  });

  it("answers in Arabic on an Arabic request", async () => {
    const result = await requirePermission(PERMISSIONS.TEAM_MANAGE, {
      locale: "ar",
      deps: deps("user_1", []),
    });
    expect(!result.ok && result.body.error.message).toBe(adminAr.forbidden);
  });

  it("passes with the permission and returns the user", async () => {
    const d = deps("user_1", [PERMISSIONS.CONTENT_MANAGE]);
    const result = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
      locale: "en",
      deps: d,
    });
    expect(result).toEqual({ ok: true, userId: "user_1" });
    expect(d.hasPermission).toHaveBeenCalledWith("content.manage");
  });

  it("errors follow the shared error shape", async () => {
    for (const userId of [null, "user_1"]) {
      const result = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
        locale: "en",
        deps: deps(userId, []),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(errorResponseSchema.safeParse(result.body).success).toBe(true);
      }
    }
  });

  it("lets a database error reach the route, which answers 500", async () => {
    const d: PermissionDeps = {
      getUserId: async () => "user_1",
      hasPermission: async () => {
        throw new Error("has_permission failed: 08006");
      },
    };
    await expect(
      requirePermission(PERMISSIONS.CONTENT_MANAGE, { locale: "en", deps: d }),
    ).rejects.toThrow("has_permission failed");
  });
});

describe("the default permission check", () => {
  it("asks has_permission through the user's client, never by role", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    const { createUserClient } = await import("@/lib/supabase/user");
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    vi.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    vi.mocked(createUserClient).mockReturnValue({ rpc } as never);

    const result = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
      locale: "en",
    });
    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledWith("has_permission", {
      key: "content.manage",
    });
  });
});
