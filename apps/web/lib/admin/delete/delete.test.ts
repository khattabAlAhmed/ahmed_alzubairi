import { ADMIN_DELETE_TYPES, PERMISSIONS, type AdminDeleteType, type Permission } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/lib/admin/audit";
import type { PermissionDeps } from "@/lib/admin/permissions";
import ar from "@/messages/ar/DeleteErrors.json";
import en from "@/messages/en/DeleteErrors.json";
import { deleteRecord, type DeleteDeps, type DeleteStore, type StoredFile } from "./handlers";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const { handleDeleteRequest } = await import("./route");
const { createDeleteStore } = await import("./store");
const consultationRoute = await import("@/app/api/admin/consultations/[id]/route");

const ADMIN = "user_admin";
const ID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

type World = {
  rows: Map<string, Set<string>>;
  files: Map<string, StoredFile[]>;
  removed: StoredFile[];
  grants: Set<string>;
  inUse: Set<string>;
  audits: AuditEntry[];
  tags: string[];
  store: DeleteStore;
  deps: DeleteDeps;
};

/** An in-memory database and bucket list behind the store interface. */
function world(locale: "ar" | "en" = "en"): World {
  const w = {
    rows: new Map<string, Set<string>>(),
    files: new Map<string, StoredFile[]>(),
    removed: [] as StoredFile[],
    grants: new Set<string>(),
    inUse: new Set<string>(),
    audits: [] as AuditEntry[],
    tags: [] as string[],
  } as World;
  const has = (type: string, id: string) => w.rows.get(type)?.has(id) ?? false;
  w.store = {
    exists: vi.fn(async (type: AdminDeleteType, id: string) => has(type, id)),
    files: vi.fn(async (type: AdminDeleteType, id: string) => w.files.get(`${type}/${id}`) ?? []),
    hasLiveGrant: vi.fn(async (id: string) => w.grants.has(id)),
    deleteRow: vi.fn(async (type: AdminDeleteType, id: string) => {
      if (w.inUse.has(id)) return "in_use" as const;
      if (!has(type, id)) return "not_found" as const;
      w.rows.get(type)!.delete(id);
      return "deleted" as const;
    }),
    removeFiles: vi.fn(async (files: StoredFile[]) => {
      w.removed.push(...files);
    }),
  };
  w.deps = {
    locale,
    userId: ADMIN,
    store: w.store,
    audit: vi.fn(async (entry: AuditEntry) => {
      w.audits.push(entry);
    }),
    revalidate: vi.fn((tag: string) => {
      w.tags.push(tag);
    }),
  };
  return w;
}

function add(w: World, type: AdminDeleteType, id: string, files: StoredFile[] = []) {
  if (!w.rows.has(type)) w.rows.set(type, new Set());
  w.rows.get(type)!.add(id);
  if (files.length) w.files.set(`${type}/${id}`, files);
}

const remove = (w: World, type: string, id = ID, confirm: unknown = id) =>
  deleteRecord(type, id, { confirm }, w.deps);

describe("deleteRecord", () => {
  it("deletes a consultation: reads its files, deletes the row (children cascade), then the objects", async () => {
    const w = world();
    const files = [
      { bucket: "attachments", key: `${ID}/a.pdf` },
      { bucket: "attachments", key: `${ID}/b.png` },
    ];
    add(w, "consultations", ID, files);
    expect(await remove(w, "consultations")).toEqual({ status: 200, body: { ok: true } });
    expect(w.rows.get("consultations")!.has(ID)).toBe(false);
    expect(w.removed).toEqual(files);
    // The rows go before the files.
    const order = [
      (w.store.files as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (w.store.deleteRow as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (w.store.removeFiles as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ];
    expect([...order].sort((a, b) => a! - b!)).toEqual(order);
    // No cache tag: consultations are never public.
    expect(w.tags).toEqual([]);
  });

  it("writes record.delete with the type and id, and no content", async () => {
    const w = world();
    add(w, "consultations", ID, [{ bucket: "attachments", key: "k" }]);
    await remove(w, "consultations");
    expect(w.audits).toEqual([{ actorId: ADMIN, action: "record.delete", entity: "consultations", entityId: ID }]);
  });

  it("refuses a confirm that names another row: 400, nothing deleted", async () => {
    const w = world();
    add(w, "consultations", ID);
    expect(await remove(w, "consultations", ID, OTHER)).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en.confirmMismatch } },
    });
    expect(w.rows.get("consultations")!.has(ID)).toBe(true);
    expect(w.store.deleteRow).not.toHaveBeenCalled();
    expect(w.audits).toEqual([]);
  });

  it("refuses a missing or malformed confirm", async () => {
    const w = world();
    add(w, "posts", ID);
    expect((await deleteRecord("posts", ID, undefined, w.deps)).status).toBe(400);
    expect((await deleteRecord("posts", ID, { confirm: "yes" }, w.deps)).status).toBe(400);
    expect((await deleteRecord("posts", ID, { confirm: ID, extra: 1 }, w.deps)).status).toBe(400);
    expect(w.store.deleteRow).not.toHaveBeenCalled();
  });

  it.each([
    "audit_log",
    "document_access_log",
    "profiles",
    "email_outbox",
    "roles",
    "role_permissions",
    "notifications",
    "home_sections",
    "pages",
    "site_settings",
    "consultation_messages",
  ])("refuses the type %s, in the user's language, touching nothing", async (type) => {
    const w = world("ar");
    expect(await remove(w, type)).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: ar.typeNotAllowed } },
    });
    expect(w.store.exists).not.toHaveBeenCalled();
  });

  it("answers 404 for a row that isn't there, or an id that isn't one", async () => {
    const w = world();
    expect(await remove(w, "posts")).toEqual({
      status: 404,
      body: { error: { code: "not_found", message: en.notFound } },
    });
    expect((await deleteRecord("posts", "nope", { confirm: ID }, w.deps)).status).toBe(404);
    expect(w.audits).toEqual([]);
  });

  it("refuses a document while a client holds a live grant: 409 with the reason", async () => {
    const w = world();
    add(w, "documents", ID, [{ bucket: "documents", key: "originals/x.pdf" }]);
    w.grants.add(ID);
    expect(await remove(w, "documents")).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.documentGranted } },
    });
    expect(w.rows.get("documents")!.has(ID)).toBe(true);
    expect(w.removed).toEqual([]);
    expect(w.audits).toEqual([]);
  });

  it("deletes a document with no live grant: the row, its original, and the public list's cache", async () => {
    const w = world();
    add(w, "documents", ID, [{ bucket: "documents", key: "originals/x.pdf" }]);
    expect((await remove(w, "documents")).status).toBe(200);
    expect(w.removed).toEqual([{ bucket: "documents", key: "originals/x.pdf" }]);
    expect(w.tags).toEqual(["content:documents"]);
  });

  it("deletes a content row with its files and refreshes its cache tag", async () => {
    const w = world();
    add(w, "posts", ID, [{ bucket: "public-media", key: "posts/cover.jpg" }]);
    expect((await remove(w, "posts")).status).toBe(200);
    expect(w.removed).toEqual([{ bucket: "public-media", key: "posts/cover.jpg" }]);
    expect(w.tags).toEqual(["content:posts"]);
    expect(w.audits[0]).toMatchObject({ entity: "posts", entityId: ID });
  });

  it("answers 409 when another row still references it", async () => {
    const w = world();
    add(w, "expertise_areas", ID);
    w.inUse.add(ID);
    expect(await remove(w, "expertise_areas")).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.inUse } },
    });
    expect(w.audits).toEqual([]);
  });

  it("still succeeds when Storage refuses a file: the row is gone and audited", async () => {
    const w = world();
    add(w, "consultations", ID, [{ bucket: "attachments", key: "k" }]);
    (w.store.removeFiles as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("storage down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await remove(w, "consultations")).status).toBe(200);
    expect(w.audits).toHaveLength(1);
    expect(logged).toHaveBeenCalledWith("admin delete: file removal failed (error)");
    logged.mockRestore();
  });

  it("removes the files and refreshes the cache even when the audit write then fails", async () => {
    const w = world();
    add(w, "posts", ID, [{ bucket: "public-media", key: "posts/cover.jpg" }]);
    (w.deps.audit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("audit down"));
    await expect(remove(w, "posts")).rejects.toThrow("audit down");
    expect(w.removed).toEqual([{ bucket: "public-media", key: "posts/cover.jpg" }]);
    expect(w.tags).toEqual(["content:posts"]);
  });

  it("changes nothing when the row delete fails, so a retry still finds the files", async () => {
    const w = world();
    add(w, "consultations", ID, [{ bucket: "attachments", key: "k" }]);
    (w.store.deleteRow as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
    await expect(remove(w, "consultations")).rejects.toThrow("db down");
    expect(w.removed).toEqual([]);
    expect(w.audits).toEqual([]);
    expect((await remove(w, "consultations")).status).toBe(200);
    expect(w.removed).toEqual([{ bucket: "attachments", key: "k" }]);
  });

  it("covers every shared type with a tag rule", async () => {
    for (const type of ADMIN_DELETE_TYPES) {
      const w = world();
      add(w, type, ID);
      expect((await remove(w, type)).status, type).toBe(200);
      const expected = type === "consultations" || type === "courses" ? [] : [type === "documents" ? "content:documents" : `content:${type}`];
      expect(w.tags, type).toEqual(expected);
    }
  });
});

describe("the route", () => {
  function deps(userId: string | null, granted: Permission[]) {
    const w = world();
    add(w, "consultations", ID, [{ bucket: "attachments", key: "k" }]);
    const permission: PermissionDeps = {
      getUserId: async () => userId,
      hasPermission: async (key) => granted.includes(key),
    };
    return {
      w,
      routeDeps: {
        permission,
        createStore: vi.fn(() => w.store),
        audit: w.deps.audit,
        revalidate: w.deps.revalidate,
      },
    };
  }

  const request = (body: unknown = { confirm: ID }) =>
    new Request(`http://localhost/api/admin/consultations/${ID}`, {
      method: "DELETE",
      headers: { referer: "http://localhost/en/dashboard" },
      body: JSON.stringify(body),
    });

  it("signed out is 401, and no store is created", async () => {
    const { w, routeDeps } = deps(null, []);
    const response = await handleDeleteRequest(request(), "consultations", ID, routeDeps);
    expect(response.status).toBe(401);
    expect(routeDeps.createStore).not.toHaveBeenCalled();
    expect(w.rows.get("consultations")!.has(ID)).toBe(true);
  });

  it("refuses a member without data.delete: 403, no store, nothing deleted", async () => {
    // The content editor's permissions, and even the full consultation set.
    const { w, routeDeps } = deps("user_editor", [
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.CONSULTATIONS_VIEW_ALL,
      PERMISSIONS.CONSULTATIONS_REPLY,
    ]);
    const response = await handleDeleteRequest(request(), "consultations", ID, routeDeps);
    expect(response.status).toBe(403);
    expect(routeDeps.createStore).not.toHaveBeenCalled();
    expect(w.rows.get("consultations")!.has(ID)).toBe(true);
    expect(w.audits).toEqual([]);
  });

  it("lets data.delete through", async () => {
    const { w, routeDeps } = deps(ADMIN, [PERMISSIONS.DATA_DELETE]);
    const response = await handleDeleteRequest(request(), "consultations", ID, routeDeps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(w.removed).toEqual([{ bucket: "attachments", key: "k" }]);
  });

  it("answers 500 without details when the store throws", async () => {
    const { w, routeDeps } = deps(ADMIN, [PERMISSIONS.DATA_DELETE]);
    (w.store.exists as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleDeleteRequest(request(), "consultations", ID, routeDeps);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
    logged.mockRestore();
  });
});

describe("the static consultation route", () => {
  it("exports DELETE next to PATCH, so /api/admin/consultations/:id reaches the delete handler", () => {
    expect(typeof consultationRoute.DELETE).toBe("function");
    expect(typeof consultationRoute.PATCH).toBe("function");
  });
});

/** A fake supabase-js client that records each call chain. */
function fakeClient(results: Record<string, unknown> = {}) {
  const calls: { table: string; ops: [string, ...unknown[]][] }[] = [];
  const storage: { bucket: string; keys: string[] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, ops: [] as [string, ...unknown[]][] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "eq", "or", "limit", "update", "delete", "maybeSingle"]) {
        chain[op] = (...args: unknown[]) => {
          call.ops.push([op, ...args]);
          return chain;
        };
      }
      chain.then = (resolve: (value: unknown) => void) =>
        resolve(results[table] ?? { data: [], error: null });
      return chain;
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (keys: string[]) => {
          storage.push({ bucket, keys });
          return { data: [], error: null };
        },
      }),
    },
  };
  return { client: client as never, calls, storage };
}

describe("createDeleteStore", () => {
  let fake: ReturnType<typeof fakeClient>;
  beforeEach(() => {
    fake = fakeClient();
  });

  it("reads a consultation's attachment keys from the attachments bucket", async () => {
    fake = fakeClient({ consultation_attachments: { data: [{ storage_key: "c/1.pdf" }, { storage_key: "c/2.png" }], error: null } });
    expect(await createDeleteStore(fake.client).files("consultations", ID)).toEqual([
      { bucket: "attachments", key: "c/1.pdf" },
      { bucket: "attachments", key: "c/2.png" },
    ]);
  });

  it("reads a content row's file column and bucket", async () => {
    fake = fakeClient({ testimonials: { data: { letter_path: "letters/x.pdf" }, error: null } });
    expect(await createDeleteStore(fake.client).files("testimonials", ID)).toEqual([
      { bucket: "internal", key: "letters/x.pdf" },
    ]);
    fake = fakeClient({ project_images: { data: [{ path: "p/1.jpg" }], error: null } });
    expect(await createDeleteStore(fake.client).files("projects", ID)).toEqual([{ bucket: "public-media", key: "p/1.jpg" }]);
    expect(await createDeleteStore(fakeClient().client).files("faqs", ID)).toEqual([]);
  });

  it("counts only a granted, unexpired request as a live grant", async () => {
    fake = fakeClient({ document_requests: { data: [{ id: OTHER }], error: null } });
    expect(await createDeleteStore(fake.client).hasLiveGrant(ID)).toBe(true);
    const ops = fake.calls[0]!.ops;
    expect(ops).toContainEqual(["eq", "document_id", ID]);
    expect(ops).toContainEqual(["eq", "status", "granted"]);
    expect(ops.find(([op]) => op === "or")?.[1]).toMatch(/^expires_at\.is\.null,expires_at\.gt\./);
  });

  it("maps a foreign key violation to in_use, and an empty delete to not_found", async () => {
    fake = fakeClient({ services: { data: null, error: { code: "23503" } } });
    expect(await createDeleteStore(fake.client).deleteRow("services", ID)).toBe("in_use");
    expect(await createDeleteStore(fakeClient().client).deleteRow("services", ID)).toBe("not_found");
  });

  it("removes files one call per bucket", async () => {
    await createDeleteStore(fake.client).removeFiles([
      { bucket: "attachments", key: "a" },
      { bucket: "public-media", key: "b" },
      { bucket: "attachments", key: "c" },
    ]);
    expect(fake.storage).toEqual([
      { bucket: "attachments", keys: ["a", "c"] },
      { bucket: "public-media", keys: ["b"] },
    ]);
  });
});
