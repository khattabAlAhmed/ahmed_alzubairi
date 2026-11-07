import { PERMISSIONS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import type { PermissionDeps } from "../permissions";
import { updateSetting, type SettingsStore } from "./handlers";
import { handleSettingsRequest, type SettingsRouteDeps } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const ADMIN = "user_admin";

function store(): SettingsStore {
  return { upsert: vi.fn(async () => {}), audit: vi.fn(async () => {}) };
}

function deps(s: SettingsStore) {
  return { locale: "en" as const, userId: ADMIN, store: s, revalidate: vi.fn() };
}

describe("updateSetting", () => {
  it.each([
    ["contact_email", "office@example.com"],
    ["whatsapp_number", "+967712345678"],
    ["linkedin_url", "https://www.linkedin.com/in/example"],
    ["social_links", [{ platform: "X", url: "https://x.com/example" }]],
    ["cv_visible", true],
    ["cv_file_key", "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b.pdf"],
  ])("saves %s, audits the key only and refreshes the settings tag", async (key, value) => {
    const s = store();
    const d = deps(s);
    const result = await updateSetting({ key, value }, d);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(s.upsert).toHaveBeenCalledWith(key, value);
    expect(d.revalidate).toHaveBeenCalledWith("site-settings");
    expect(s.audit).toHaveBeenCalledWith({
      actorId: ADMIN,
      action: "settings.update",
      entity: "site_settings",
      entityId: key,
      metadata: { key },
    });
  });

  it.each([
    ["an unknown key", { key: "admin_email", value: "a@example.com" }],
    [
      "a javascript: social URL",
      { key: "social_links", value: [{ platform: "X", url: "javascript:alert(1)" }] },
    ],
    [
      "a data: social URL",
      { key: "social_links", value: [{ platform: "X", url: "data:text/html,hi" }] },
    ],
    [
      "an http: social URL",
      { key: "social_links", value: [{ platform: "X", url: "http://x.com/a" }] },
    ],
    ["a javascript: LinkedIn URL", { key: "linkedin_url", value: "javascript:alert(1)" }],
    ["a LinkedIn URL on another host", { key: "linkedin_url", value: "https://evil.com/in/x" }],
    ["a value of the wrong type", { key: "cv_visible", value: "yes" }],
    ["a bad email", { key: "contact_email", value: "not-an-email" }],
    ["a number without +", { key: "whatsapp_number", value: "967712345678" }],
    ["two keys at once", { key: "cv_visible", value: true, contact_email: "a@b.co" }],
    ["no body", undefined],
  ])("refuses %s and writes nothing", async (_label, body) => {
    const s = store();
    const d = deps(s);
    const result = await updateSetting(body, d);
    expect(result).toMatchObject({
      status: 400,
      body: { error: { code: "validation_failed" } },
    });
    expect(s.upsert).not.toHaveBeenCalled();
    expect(s.audit).not.toHaveBeenCalled();
    expect(d.revalidate).not.toHaveBeenCalled();
  });
});

function routeDeps(userId: string | null, granted: Permission[]) {
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => granted.includes(key),
  };
  const created = store();
  return {
    permission,
    createStore: vi.fn(() => created),
    revalidate: vi.fn(),
    created,
  } satisfies SettingsRouteDeps & { created: SettingsStore };
}

const request = (body: unknown) =>
  new Request("http://localhost/api/admin/settings", {
    method: "PATCH",
    headers: { referer: "http://localhost/en/dashboard" },
    body: JSON.stringify(body),
  });

describe("PATCH /api/admin/settings", () => {
  const body = { key: "cv_visible", value: true };

  it("signed out is 401, and no database client is created", async () => {
    const d = routeDeps(null, []);
    const response = await handleSettingsRequest(request(body), d);
    expect(response.status).toBe(401);
    expect(d.createStore).not.toHaveBeenCalled();
  });

  it("without team.manage is 403, even with content.manage", async () => {
    const d = routeDeps("user_editor", [PERMISSIONS.CONTENT_MANAGE]);
    const response = await handleSettingsRequest(request(body), d);
    expect(response.status).toBe(403);
    expect(d.createStore).not.toHaveBeenCalled();
  });

  it("with team.manage saves the setting", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleSettingsRequest(request(body), d);
    expect(response.status).toBe(200);
    expect(d.created.upsert).toHaveBeenCalledWith("cv_visible", true);
  });

  it("a database failure is a 500 with no detail", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    d.created.upsert = vi.fn(async () => {
      throw new Error("db down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleSettingsRequest(request(body), d);
    expect(response.status).toBe(500);
  });
});
