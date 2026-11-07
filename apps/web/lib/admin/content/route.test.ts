import { PERMISSIONS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import type { PermissionDeps } from "../permissions";
import type { ContentStore } from "./handlers";
import { handleContentRequest, type ContentRouteDeps } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const ID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";

function store(): ContentStore {
  return {
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    insert: vi.fn(async () => ({ ok: true as const, id: ID })),
    update: vi.fn(async () => ({ ok: true as const, id: ID })),
    replaceProjectImages: vi.fn(async () => {}),
    replaceProjectServices: vi.fn(async () => ({ ok: true as const, id: ID })),
    servicesExist: vi.fn(async () => true),
    remove: vi.fn(async () => {}),
    audit: vi.fn(async () => {}),
  };
}

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
  } satisfies ContentRouteDeps & { created: ContentStore };
}

const request = (method: string, body?: unknown, locale = "en") =>
  new Request("http://localhost/api/admin/content/faqs", {
    method,
    headers: { referer: `http://localhost/${locale}/dashboard` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const draftFaq = {
  status: "draft",
  category: "account",
  questionEn: "Q?",
};

describe("content routes", () => {
  it.each(["GET", "POST", "PATCH"] as const)(
    "%s signed out is 401, and no database client is created",
    async (method) => {
      const deps = routeDeps(null, []);
      const response = await handleContentRequest(
        method,
        request(method, method === "GET" ? undefined : draftFaq),
        "faqs",
        deps,
      );
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthenticated");
      expect(deps.createStore).not.toHaveBeenCalled();
    },
  );

  it.each(["GET", "POST", "PATCH"] as const)(
    "%s without content.manage is 403, and no database client is created",
    async (method) => {
      const deps = routeDeps("user_1", [
        PERMISSIONS.TESTIMONIALS_APPROVE,
        PERMISSIONS.TEAM_MANAGE,
      ]);
      const response = await handleContentRequest(
        method,
        request(method, method === "GET" ? undefined : draftFaq),
        "faqs",
        deps,
      );
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("forbidden");
      expect(deps.createStore).not.toHaveBeenCalled();
    },
  );

  it("a body can't grant the permission", async () => {
    const deps = routeDeps("user_1", []);
    const response = await handleContentRequest(
      "POST",
      request("POST", { ...draftFaq, permissions: ["content.manage"] }),
      "faqs",
      deps,
    );
    expect(response.status).toBe(403);
  });

  it("POST with content.manage creates the row and refreshes the tag", async () => {
    const deps = routeDeps("user_1", [PERMISSIONS.CONTENT_MANAGE]);
    const response = await handleContentRequest(
      "POST",
      request("POST", draftFaq),
      "faqs",
      deps,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ID });
    expect(deps.revalidate).toHaveBeenCalledWith("content:faqs");
  });

  it("invalid JSON is 400", async () => {
    const deps = routeDeps("user_1", [PERMISSIONS.CONTENT_MANAGE]);
    const response = await handleContentRequest(
      "POST",
      new Request("http://localhost/api/admin/content/faqs", {
        method: "POST",
        body: "{not json",
      }),
      "faqs",
      deps,
    );
    expect(response.status).toBe(400);
  });

  it("GET lists rows", async () => {
    const deps = routeDeps("user_1", [PERMISSIONS.CONTENT_MANAGE]);
    const response = await handleContentRequest(
      "GET",
      request("GET"),
      "faqs",
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [] });
  });

  it("a database error is 500 in the user's language, with no detail", async () => {
    const deps = routeDeps("user_1", [PERMISSIONS.CONTENT_MANAGE]);
    vi.mocked(deps.created.list).mockRejectedValueOnce(
      new Error("faqs list failed: 42P01"),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleContentRequest(
      "GET",
      request("GET", undefined, "ar"),
      "faqs",
      deps,
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("42P01");
    error.mockRestore();
  });
});
