import { PERMISSIONS, UPLOAD_TARGETS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import type { PermissionDeps } from "../permissions";
import { PNG_BYTES, streamOf } from "./fixtures";
import type { UploadStore } from "./handlers";
import { handleUploadRequest, type UploadRouteDeps } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const UUID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";

function routeDeps(userId: string | null, granted: Permission[]) {
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => granted.includes(key),
  };
  const created: UploadStore = {
    signUpload: vi.fn(async () => "https://example.supabase.co/sign?token=t"),
    open: vi.fn(async () => ({
      size: PNG_BYTES.length,
      stream: streamOf(PNG_BYTES),
    })),
    move: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  return {
    permission,
    createStore: vi.fn(() => created),
    detectMime: vi.fn(async () => "image/png"),
    created,
  } satisfies UploadRouteDeps & { created: UploadStore };
}

const request = (path: string, body: unknown, locale = "en") =>
  new Request(`http://localhost/api/admin/uploads/${path}`, {
    method: "POST",
    headers: { referer: `http://localhost/${locale}/dashboard` },
    body: JSON.stringify(body),
  });

const uploadBody = (target: string) => ({
  target,
  fileName: "file.pdf",
  mime: "application/pdf",
  sizeBytes: 100,
});

const needed = (target: string): Permission =>
  target === "document"
    ? PERMISSIONS.DOCUMENTS_MANAGE
    : PERMISSIONS.CONTENT_MANAGE;

const other = (target: string): Permission =>
  target === "document"
    ? PERMISSIONS.CONTENT_MANAGE
    : PERMISSIONS.DOCUMENTS_MANAGE;

describe("upload routes", () => {
  it.each(["upload-url", "finalize"] as const)(
    "%s signed out is 401, and no Storage client is created",
    async (action) => {
      const deps = routeDeps(null, []);
      const response = await handleUploadRequest(
        action,
        request(action, uploadBody("media")),
        deps,
      );
      expect(response.status).toBe(401);
      expect(deps.createStore).not.toHaveBeenCalled();
    },
  );

  describe.each(UPLOAD_TARGETS)("target %s", (target) => {
    it("upload-url is 403 without its permission, even with the other one", async () => {
      const deps = routeDeps("user_1", [other(target)]);
      const response = await handleUploadRequest(
        "upload-url",
        request("upload-url", uploadBody(target), "ar"),
        deps,
      );
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe("forbidden");
      expect(body.error.message).toBe("ليست لديك صلاحية للقيام بهذا الإجراء.");
      expect(deps.createStore).not.toHaveBeenCalled();
    });

    it("finalize is 403 without its permission, even with the other one", async () => {
      const deps = routeDeps("user_1", [other(target)]);
      const response = await handleUploadRequest(
        "finalize",
        request("finalize", { target, key: `pending/${UUID}.pdf` }),
        deps,
      );
      expect(response.status).toBe(403);
      expect(deps.createStore).not.toHaveBeenCalled();
    });

    it("upload-url is 200 with its permission", async () => {
      const deps = routeDeps("user_1", [needed(target)]);
      const response = await handleUploadRequest(
        "upload-url",
        request("upload-url", uploadBody(target)),
        deps,
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.key).toMatch(/^pending\/[0-9a-f-]{36}\.pdf$/);
    });
  });

  it("finalize passes with the permission and returns the final key", async () => {
    const deps = routeDeps("user_1", [PERMISSIONS.CONTENT_MANAGE]);
    const response = await handleUploadRequest(
      "finalize",
      request("finalize", { target: "media", key: `pending/${UUID}.png` }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ key: `${UUID}.png` });
  });

  it("a body with no valid target still needs a permission", async () => {
    const deps = routeDeps("user_1", []);
    const response = await handleUploadRequest(
      "upload-url",
      request("upload-url", { target: "x" }),
      deps,
    );
    expect(response.status).toBe(403);
  });

  it("a Storage failure is a 500 with no detail", async () => {
    const deps = routeDeps("user_1", [PERMISSIONS.CONTENT_MANAGE]);
    deps.created.signUpload = vi.fn(async () => {
      throw new Error("storage down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleUploadRequest(
      "upload-url",
      request("upload-url", uploadBody("media")),
      deps,
    );
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});
