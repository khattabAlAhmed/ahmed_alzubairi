import {
  DOCUMENTS_CACHE_TAG,
  PERMISSIONS,
  type AdminDocument,
  type Permission,
} from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/AdminDocumentErrors.json";
import en from "@/messages/en/AdminDocumentErrors.json";
import type { AuditEntry } from "../audit";
import type { PermissionDeps } from "../permissions";
import {
  createDocument,
  updateDocument,
  type DocumentDeps,
  type DocumentStore,
  type DocumentWrite,
} from "./handlers";
import { documentKeyMime } from "./keys";
import { handleDocumentsRequest, type DocumentsRouteDeps } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const ADMIN = "user_admin";
const DOC_ID = "123e4567-e89b-42d3-a456-426614174000";
const UUID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const PDF_KEY = `${UUID}.pdf`;
const PNG_KEY = "4f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b.png";
const OLD_KEY = "5f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b.pdf";
const SECRET_KEY = "9f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b.pdf";

const LISTED: AdminDocument = {
  id: DOC_ID,
  category: "course_certificate",
  titleAr: "شهادة",
  titleEn: "Certificate",
  mime: "application/pdf",
  accessMode: "view",
  status: "published",
};

/** An in-memory store: rows by id, and the keys the bucket holds. */
function memoryStore(bucket: string[] = [PDF_KEY, PNG_KEY, OLD_KEY]) {
  const rows = new Map<string, DocumentWrite>([
    [
      DOC_ID,
      {
        category: "course_certificate",
        title_ar: "شهادة",
        title_en: "Certificate",
        access_mode: "view",
        status: "draft",
        storage_key: OLD_KEY,
        mime: "application/pdf",
      },
    ],
  ]);
  const files = new Set(bucket);
  const store = {
    rows,
    files,
    list: vi.fn(async () => [LISTED]),
    fileExists: vi.fn(async (key: string) => files.has(key)),
    keyInUse: vi.fn(async (key: string, exceptId?: string) =>
      [...rows].some(([id, row]) => id !== exceptId && row.storage_key === key),
    ),
    insert: vi.fn(async (row: DocumentWrite) => {
      const id = "223e4567-e89b-42d3-a456-426614174001";
      rows.set(id, row);
      return id;
    }),
    currentKey: vi.fn(async (id: string) => rows.get(id)?.storage_key ?? null),
    update: vi.fn(async (id: string, changes: Partial<DocumentWrite>) => {
      const row = rows.get(id);
      if (!row) return false;
      rows.set(id, { ...row, ...changes });
      return true;
    }),
    removeFile: vi.fn(async (key: string) => {
      files.delete(key);
    }),
  } satisfies DocumentStore & { rows: unknown; files: unknown };
  return store;
}

function deps(store = memoryStore(), locale: "ar" | "en" = "en") {
  return {
    locale,
    userId: ADMIN,
    store,
    audit: vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {}),
    revalidate: vi.fn<(tag: string) => void>(),
  } satisfies DocumentDeps;
}

const created = {
  category: "course_certificate",
  titleAr: "شهادة دورة",
  titleEn: "Course certificate",
  accessMode: "view_download",
  status: "draft",
  key: PDF_KEY,
};

describe("documentKeyMime", () => {
  it.each([
    [PDF_KEY, "application/pdf"],
    [PNG_KEY, "image/png"],
    [`${UUID}.jpg`, "image/jpeg"],
  ])("reads %s as %s", (key, mime) => {
    expect(documentKeyMime(key)).toBe(mime);
  });

  it.each([
    ["a pending key", `pending/${UUID}.pdf`],
    ["a DOCX from another target", `${UUID}.docx`],
    ["a path with folders", `documents/${UUID}.pdf`],
    ["a climb out", `../${UUID}.pdf`],
    ["a client name", "certificate.pdf"],
    ["a capital extension", `${UUID}.PDF`],
    ["two extensions", `${UUID}.pdf.png`],
  ])("refuses %s", (_label, key) => {
    expect(documentKeyMime(key)).toBeNull();
  });
});

describe("createDocument", () => {
  it("saves the row with the key and the type the key stands for, audits it and refreshes the public list", async () => {
    const d = deps();
    const result = await createDocument(created, d);
    expect(result).toEqual({ status: 200, body: { id: "223e4567-e89b-42d3-a456-426614174001" } });
    expect(d.store.insert).toHaveBeenCalledWith({
      category: "course_certificate",
      title_ar: "شهادة دورة",
      title_en: "Course certificate",
      access_mode: "view_download",
      status: "draft",
      storage_key: PDF_KEY,
      mime: "application/pdf",
    });
    expect(d.revalidate).toHaveBeenCalledWith(DOCUMENTS_CACHE_TAG);
    expect(d.audit).toHaveBeenCalledWith({
      actorId: ADMIN,
      action: "document.create",
      entity: "documents",
      entityId: "223e4567-e89b-42d3-a456-426614174001",
      metadata: { category: "course_certificate", accessMode: "view_download", status: "draft" },
    });
    expect(JSON.stringify(d.audit.mock.calls)).not.toContain(PDF_KEY);
    expect(JSON.stringify(result)).not.toContain(PDF_KEY);
  });

  it.each([
    ["a pending key", `pending/${UUID}.pdf`],
    ["a key from the attachments target", `${UUID}.docx`],
    ["a client path", "documents/../secret.pdf"],
  ])("refuses %s as the wrong target and writes nothing", async (_label, key) => {
    const d = deps(memoryStore([key]));
    const result = await createDocument({ ...created, key }, d);
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en.keyInvalid } },
    });
    expect(d.store.fileExists).not.toHaveBeenCalled();
    expect(d.store.insert).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("refuses a file another document already holds (409)", async () => {
    const d = deps();
    const result = await createDocument({ ...created, key: OLD_KEY }, d);
    expect(result).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.fileInUse } },
    });
    expect(d.store.insert).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
  });

  it("refuses a key that isn't in the documents bucket (finalized for another target, or never uploaded)", async () => {
    const d = deps(memoryStore([]), "ar");
    const result = await createDocument(created, d);
    expect(result).toEqual({
      status: 404,
      body: { error: { code: "not_found", message: ar.fileNotFound } },
    });
    expect(d.store.insert).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
  });

  it.each([
    ["no key", { ...created, key: undefined }],
    ["an unknown category", { ...created, category: "diploma" }],
    ["an unknown access mode", { ...created, accessMode: "download" }],
    ["an empty title", { ...created, titleAr: " " }],
    ["a storage_key field", { ...created, storageKey: PDF_KEY }],
    ["no body", undefined],
  ])("refuses %s", async (_label, body) => {
    const d = deps();
    expect(await createDocument(body, d)).toMatchObject({
      status: 400,
      body: { error: { code: "validation_failed" } },
    });
    expect(d.store.insert).not.toHaveBeenCalled();
  });
});

describe("updateDocument", () => {
  it("edits the titles, category, access mode and status, audits the field names and refreshes the list", async () => {
    const d = deps();
    const result = await updateDocument(
      {
        id: DOC_ID,
        titleEn: "Renamed",
        category: "experience_certificate",
        accessMode: "view_download",
        status: "published",
      },
      d,
    );
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(d.store.rows.get(DOC_ID)).toMatchObject({
      title_en: "Renamed",
      category: "experience_certificate",
      access_mode: "view_download",
      status: "published",
      storage_key: OLD_KEY,
    });
    expect(d.revalidate).toHaveBeenCalledWith(DOCUMENTS_CACHE_TAG);
    expect(d.audit).toHaveBeenCalledWith({
      actorId: ADMIN,
      action: "document.update",
      entity: "documents",
      entityId: DOC_ID,
      // Schema order, whatever order the request used.
      metadata: { fields: ["category", "titleEn", "accessMode", "status"] },
    });
    expect(d.store.removeFile).not.toHaveBeenCalled();
  });

  it("replaces the file: new key and type, then the old original is deleted", async () => {
    const d = deps();
    const result = await updateDocument({ id: DOC_ID, key: PNG_KEY }, d);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(d.store.rows.get(DOC_ID)).toMatchObject({ storage_key: PNG_KEY, mime: "image/png" });
    expect(d.store.removeFile).toHaveBeenCalledWith(OLD_KEY);
    expect(d.audit.mock.calls[0]?.[0].metadata).toEqual({ fields: ["file"] });
    expect(JSON.stringify(d.audit.mock.calls)).not.toMatch(/[0-9a-f-]{36}\.(pdf|png)/);
  });

  it("deletes the old original before the audit write, so a failed audit leaves no file behind", async () => {
    const d = deps();
    d.audit.mockRejectedValueOnce(new Error("audit_log insert failed: 57014"));
    await expect(updateDocument({ id: DOC_ID, key: PNG_KEY }, d)).rejects.toThrow("audit_log");
    expect(d.store.removeFile).toHaveBeenCalledWith(OLD_KEY);
    expect(d.store.files.has(OLD_KEY)).toBe(false);
  });

  it("refuses a file another document already holds (409), and writes nothing", async () => {
    const d = deps();
    d.store.rows.set("423e4567-e89b-42d3-a456-426614174003", {
      ...(d.store.rows.get(DOC_ID) as DocumentWrite),
      storage_key: PNG_KEY,
    });
    const result = await updateDocument({ id: DOC_ID, key: PNG_KEY }, d);
    expect(result).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.fileInUse } },
    });
    expect(d.store.update).not.toHaveBeenCalled();
    expect(d.store.removeFile).not.toHaveBeenCalled();
  });

  it("never deletes an original another row still points at", async () => {
    const d = deps();
    // A row from before the sharing check, holding the same file.
    d.store.rows.set("523e4567-e89b-42d3-a456-426614174004", {
      ...(d.store.rows.get(DOC_ID) as DocumentWrite),
    });
    expect(await updateDocument({ id: DOC_ID, key: PNG_KEY }, d)).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(d.store.removeFile).not.toHaveBeenCalled();
    expect(d.store.files.has(OLD_KEY)).toBe(true);
  });

  it("keeps the change when deleting the old original fails", async () => {
    const d = deps();
    d.store.removeFile.mockRejectedValueOnce(new Error("storage down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await updateDocument({ id: DOC_ID, key: PNG_KEY }, d)).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(d.store.rows.get(DOC_ID)?.storage_key).toBe(PNG_KEY);
  });

  it("resending the same file writes nothing new and deletes nothing", async () => {
    const d = deps();
    expect(await updateDocument({ id: DOC_ID, key: OLD_KEY }, d)).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(d.store.fileExists).not.toHaveBeenCalled();
    expect(d.store.removeFile).not.toHaveBeenCalled();
  });

  it("refuses a new key from the wrong target, keeping the old file", async () => {
    const d = deps();
    const result = await updateDocument({ id: DOC_ID, key: `pending/${UUID}.pdf` }, d);
    expect(result).toMatchObject({ status: 400, body: { error: { message: en.keyInvalid } } });
    expect(d.store.update).not.toHaveBeenCalled();
    expect(d.store.removeFile).not.toHaveBeenCalled();
  });

  it("refuses a new key the bucket doesn't hold", async () => {
    const d = deps();
    const result = await updateDocument({ id: DOC_ID, key: SECRET_KEY }, d);
    expect(result).toMatchObject({ status: 404, body: { error: { message: en.fileNotFound } } });
    expect(d.store.update).not.toHaveBeenCalled();
  });

  it("answers 404 for a document that doesn't exist", async () => {
    const d = deps();
    const result = await updateDocument(
      { id: "323e4567-e89b-42d3-a456-426614174002", status: "published" },
      d,
    );
    expect(result).toEqual({
      status: 404,
      body: { error: { code: "not_found", message: en.notFound } },
    });
    expect(d.audit).not.toHaveBeenCalled();
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it.each([
    ["only an id", { id: DOC_ID }],
    ["a bad id", { id: "1", status: "published" }],
    ["a storage_key field", { id: DOC_ID, storageKey: SECRET_KEY }],
    ["a mime field", { id: DOC_ID, mime: "text/html" }],
  ])("refuses %s", async (_label, body) => {
    const d = deps();
    expect(await updateDocument(body, d)).toMatchObject({ status: 400 });
    expect(d.store.update).not.toHaveBeenCalled();
  });
});

function routeDeps(userId: string | null, granted: Permission[]) {
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => granted.includes(key),
  };
  const store = memoryStore();
  return {
    permission,
    createStore: vi.fn(() => store),
    audit: vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {}),
    revalidate: vi.fn(),
    store,
  } satisfies DocumentsRouteDeps & { store: unknown };
}

const request = (method: "GET" | "POST" | "PATCH", body?: unknown) =>
  new Request("http://localhost/api/admin/documents", {
    method,
    headers: { referer: "http://localhost/en/dashboard/documents" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

describe("/api/admin/documents", () => {
  const calls = [
    ["GET", undefined],
    ["POST", created],
    ["PATCH", { id: DOC_ID, status: "published" }],
  ] as const;

  it.each(calls)("%s signed out is 401, and no database client is made", async (method, body) => {
    const d = routeDeps(null, []);
    const response = await handleDocumentsRequest(request(method, body), d);
    expect(response.status).toBe(401);
    expect(d.createStore).not.toHaveBeenCalled();
  });

  it.each(calls)(
    "%s as a content editor (content.manage, no documents.manage) is 403",
    async (method, body) => {
      const d = routeDeps("user_editor", [PERMISSIONS.CONTENT_MANAGE]);
      const response = await handleDocumentsRequest(request(method, body), d);
      expect(response.status).toBe(403);
      expect(d.createStore).not.toHaveBeenCalled();
      expect(d.audit).not.toHaveBeenCalled();
    },
  );

  it.each(calls)(
    "%s with only documents.view is 403: viewing isn't managing",
    async (method, body) => {
      const d = routeDeps("user_viewer", [PERMISSIONS.DOCUMENTS_VIEW]);
      expect((await handleDocumentsRequest(request(method, body), d)).status).toBe(403);
    },
  );

  it("GET lists the documents with no storage key", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.DOCUMENTS_MANAGE]);
    const response = await handleDocumentsRequest(request("GET"), d);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ documents: [LISTED] });
    expect(text).not.toMatch(/storage_?key|\.pdf"/i);
  });

  it("POST then PATCH: ids and ok only, never a storage key, two audit rows, two refreshes", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.DOCUMENTS_MANAGE]);
    const posted = await handleDocumentsRequest(request("POST", created), d);
    expect(posted.status).toBe(200);
    const postText = await posted.text();
    expect(Object.keys(JSON.parse(postText))).toEqual(["id"]);
    expect(postText).not.toContain(PDF_KEY);

    const patched = await handleDocumentsRequest(
      request("PATCH", { id: DOC_ID, key: PNG_KEY, status: "published" }),
      d,
    );
    expect(patched.status).toBe(200);
    const patchText = await patched.text();
    expect(JSON.parse(patchText)).toEqual({ ok: true });
    expect(patchText).not.toMatch(/[0-9a-f-]{36}\.(pdf|png)/);

    expect(d.audit.mock.calls.map(([entry]) => entry.action)).toEqual([
      "document.create",
      "document.update",
    ]);
    expect(d.revalidate.mock.calls).toEqual([[DOCUMENTS_CACHE_TAG], [DOCUMENTS_CACHE_TAG]]);
  });

  it("a failure is a 500 that names no key and no body", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.DOCUMENTS_MANAGE]);
    d.store.insert.mockRejectedValueOnce(new Error(`insert failed for ${PDF_KEY}`));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleDocumentsRequest(request("POST", created), d);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(PDF_KEY);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("شهادة دورة");
  });
});

describe("AdminDocumentErrors messages", () => {
  it("has the same keys in Arabic and English", () => {
    expect(Object.keys(ar).toSorted()).toEqual(Object.keys(en).toSorted());
  });
});
