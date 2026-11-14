import { SIGNED_URL_TTL_SECONDS } from "@repo/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/supabase/service";
import ar from "@/messages/ar/DocumentOpenErrors.json";
import en from "@/messages/en/DocumentOpenErrors.json";
import {
  deleteOldViewCopies,
  DOCUMENT_JOBS,
  VIEW_COPY_PAGE_SIZE,
} from "../cron/document-jobs";
import {
  downloadName,
  type DocumentOpenStore,
  type StoredDocument,
} from "./handlers";
import { handleOpenDocument, type DocumentOpenRouteDeps } from "./route";
import { createDocumentOpenStore } from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const DOC = "123e4567-e89b-42d3-a456-426614174001";
const GRANT = "223e4567-e89b-42d3-a456-426614174001";
const ORIGINAL_KEY = "9f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b.pdf";

const viewDoc: StoredDocument = {
  storageKey: ORIGINAL_KEY,
  mime: "application/pdf",
  accessMode: "view",
  titleAr: "شهادة دورة",
  titleEn: "Course certificate",
};

/** A store that records the order of its calls. */
function memoryStore(overrides: Partial<DocumentOpenStore> = {}) {
  const calls: string[] = [];
  const track =
    <A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) =>
    vi.fn(async (...args: A) => {
      calls.push(name);
      return fn(...args);
    });
  const store = {
    calls,
    viewer: track("viewer", async () => ({ fullName: "سارة أحمد", locale: "ar" as const, timeZone: "Asia/Aden" })),
    isTeamViewer: track("isTeamViewer", async () => false),
    liveGrant: track("liveGrant", async (): Promise<string | null> => GRANT),
    document: track("document", async (): Promise<StoredDocument | null> => viewDoc),
    logAccess: track("logAccess", async () => {}),
    readOriginal: track("readOriginal", async () => new Uint8Array([1, 2, 3])),
    saveCopy: track("saveCopy", async () => "copy-1.pdf"),
    signCopy: track("signCopy", async () => "https://storage.example.invalid/sign/copy-1.pdf?token=t"),
    ...overrides,
  };
  return store;
}

function routeDeps(userId: string | null, store = memoryStore()) {
  const audit = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {
    store.calls.push("audit");
  });
  const watermark = vi.fn(async (original: Uint8Array) => {
    store.calls.push("watermark");
    return new Uint8Array([...original, 9]);
  });
  return {
    getUserId: async () => userId,
    createStore: vi.fn(() => store as DocumentOpenStore),
    audit,
    watermark,
    markText: vi.fn(() => "سارة أحمد · 14 نوفمبر 2026"),
    now: () => new Date("2026-11-14T10:00:00.000Z"),
    store,
  } satisfies DocumentOpenRouteDeps & { store: unknown };
}

const open = (deps: ReturnType<typeof routeDeps>, query = "", id: string = DOC) =>
  handleOpenDocument(
    new Request(`http://localhost/api/documents/${id}/open${query}`, {
      headers: { referer: "http://localhost/ar/account/documents" },
    }),
    id,
    deps,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/documents/:id/open", () => {
  it("refuses a signed-out caller (401) without a database client", async () => {
    const d = routeDeps(null);
    expect((await open(d)).status).toBe(401);
    expect(d.createStore).not.toHaveBeenCalled();
  });

  it("a client with a live grant: logs, audits, watermarks, then a 60-second URL to the copy", async () => {
    const d = routeDeps("user_client");
    const response = await open(d);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      url: "https://storage.example.invalid/sign/copy-1.pdf?token=t",
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      accessMode: "view",
    });
    expect(d.store.logAccess).toHaveBeenCalledWith({ requestId: GRANT, documentId: DOC, action: "view" });
    expect(d.audit).toHaveBeenCalledWith({
      actorId: "user_client",
      action: "document.view",
      entity: "documents",
      entityId: DOC,
      metadata: { requestId: GRANT },
    });
    // Written before any copy exists, and the URL comes last.
    const order = d.store.calls;
    expect(order.indexOf("logAccess")).toBeLessThan(order.indexOf("readOriginal"));
    expect(order.indexOf("audit")).toBeLessThan(order.indexOf("readOriginal"));
    expect(order.indexOf("saveCopy")).toBeLessThan(order.indexOf("signCopy"));
    expect(d.store.signCopy).toHaveBeenCalledWith("copy-1.pdf", null);
    expect(d.watermark).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), "application/pdf", "سارة أحمد · 14 نوفمبر 2026");
  });

  it("never sends the original: the answer names neither its key nor its bucket", async () => {
    const d = routeDeps("user_client");
    const text = await (await open(d)).text();
    expect(text).not.toContain(ORIGINAL_KEY);
    expect(d.store.signCopy).not.toHaveBeenCalledWith(ORIGINAL_KEY, expect.anything());
  });

  it("no live grant (none, expired or revoked): 404, and nothing logged or copied", async () => {
    const d = routeDeps("user_client", memoryStore({ liveGrant: vi.fn(async () => null) }));
    const response = await open(d);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toEqual({ code: "not_found", message: ar.notFound });
    expect(d.store.logAccess).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
    expect(d.store.readOriginal).not.toHaveBeenCalled();
  });

  it("a user with no profile: 404, nothing logged", async () => {
    const d = routeDeps("user_new", memoryStore({ viewer: vi.fn(async () => null) }));
    expect((await open(d)).status).toBe(404);
    expect(d.store.logAccess).not.toHaveBeenCalled();
  });

  it("download on a view-only document: 403, nothing logged", async () => {
    const d = routeDeps("user_client");
    const response = await open(d, "?action=download");
    expect(response.status).toBe(403);
    expect((await response.json()).error).toEqual({ code: "forbidden", message: ar.downloadNotAllowed });
    expect(d.store.logAccess).not.toHaveBeenCalled();
    expect(d.store.readOriginal).not.toHaveBeenCalled();
  });

  it("download on a view-and-download document: logged as a download, signed as an attachment", async () => {
    const d = routeDeps("user_client", memoryStore({
      document: vi.fn(async () => ({ ...viewDoc, accessMode: "view_download" as const })),
    }));
    const response = await open(d, "?action=download");
    expect(response.status).toBe(200);
    expect((await response.json()).accessMode).toBe("view_download");
    expect(d.store.logAccess).toHaveBeenCalledWith({ requestId: GRANT, documentId: DOC, action: "download" });
    expect(d.audit.mock.calls[0]?.[0].action).toBe("document.download");
    expect(d.store.signCopy).toHaveBeenCalledWith("copy-1.pdf", "شهادة دورة.pdf");
  });

  it("a team member with documents.view opens any document, no grant needed, audited as team", async () => {
    const d = routeDeps("user_member", memoryStore({
      isTeamViewer: vi.fn(async () => true),
      liveGrant: vi.fn(async () => null),
    }));
    expect((await open(d)).status).toBe(200);
    expect(d.store.liveGrant).not.toHaveBeenCalled();
    expect(d.store.logAccess).not.toHaveBeenCalled();
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "user_member",
      action: "document.view",
      metadata: { team: true },
    }));
  });

  it("a team member without documents.view (and no grant) is refused like anyone else", async () => {
    const d = routeDeps("user_editor", memoryStore({ liveGrant: vi.fn(async () => null) }));
    expect((await open(d)).status).toBe(404);
    expect(d.audit).not.toHaveBeenCalled();
  });

  it("a granted document that has since been deleted: 404", async () => {
    const d = routeDeps("user_client", memoryStore({ document: vi.fn(async () => null) }));
    expect((await open(d)).status).toBe(404);
    expect(d.store.logAccess).not.toHaveBeenCalled();
  });

  it.each([
    ["a bad id", "", "1"],
    ["an unknown action", "?action=print", DOC],
    ["an extra parameter", "?action=view&as=user_other", DOC],
  ])("refuses %s (400)", async (_label, query, id) => {
    const d = routeDeps("user_client");
    expect((await open(d, query, id)).status).toBe(400);
    expect(d.store.liveGrant).not.toHaveBeenCalled();
  });

  it.each([
    ["ar", ar.originalMissing],
    ["en", en.originalMissing],
  ] as const)("a missing original is a 404 in %s, with no copy made", async (locale, message) => {
    const d = routeDeps("user_client", memoryStore({ readOriginal: vi.fn(async () => null) }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleOpenDocument(
      new Request(`http://localhost/api/documents/${DOC}/open`, {
        headers: { referer: `http://localhost/${locale}/account/documents/x` },
      }),
      DOC,
      d,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message } });
    // The open was logged before the read, by design; nothing was stamped, saved or signed.
    expect(d.store.logAccess).toHaveBeenCalled();
    expect(d.watermark).not.toHaveBeenCalled();
    expect(d.store.saveCopy).not.toHaveBeenCalled();
    expect(d.store.signCopy).not.toHaveBeenCalled();
    // The team's log line names the document, never the key or the viewer.
    const lines = JSON.stringify(logged.mock.calls);
    expect(lines).toContain(DOC);
    expect(lines).not.toContain(ORIGINAL_KEY);
    expect(lines).not.toContain("سارة");
  });

  it("the missing-original message differs from the no-access one", () => {
    expect(en.originalMissing).not.toBe(en.notFound);
    expect(ar.originalMissing).not.toBe(ar.notFound);
  });

  it("a failure after the log is a 500 that names no key", async () => {
    const d = routeDeps("user_client", memoryStore({
      readOriginal: vi.fn(async () => { throw new Error("original download failed: Internal error"); }),
    }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await open(d);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(ORIGINAL_KEY);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(ORIGINAL_KEY);
  });
});

describe("createDocumentOpenStore.readOriginal", () => {
  function storageWith(result: { data: unknown; error: unknown }) {
    const download = vi.fn(async () => result);
    const service = { storage: { from: vi.fn(() => ({ download })) } };
    return { store: createDocumentOpenStore({} as never, service as never, "user_client"), download, service };
  }

  it("returns null when Storage has no object at the key", async () => {
    const { store, service, download } = storageWith({
      data: null,
      error: { name: "StorageApiError", message: "Object not found", status: 400, statusCode: "404" },
    });
    expect(await store.readOriginal(ORIGINAL_KEY)).toBeNull();
    expect(service.storage.from).toHaveBeenCalledWith("documents");
    expect(download).toHaveBeenCalledWith(ORIGINAL_KEY);
  });

  it("still throws on any other Storage failure", async () => {
    const { store } = storageWith({
      data: null,
      error: { name: "StorageApiError", message: "Internal error", status: 500, statusCode: "500" },
    });
    await expect(store.readOriginal(ORIGINAL_KEY)).rejects.toThrow("original download failed: Internal error");
  });

  it("returns the bytes when the object is there", async () => {
    const { store } = storageWith({ data: new Blob([new Uint8Array([7, 8])]), error: null });
    expect(await store.readOriginal(ORIGINAL_KEY)).toEqual(new Uint8Array([7, 8]));
  });
});

describe("downloadName", () => {
  it("uses the title in the viewer's language, with the file's extension", () => {
    expect(downloadName(viewDoc, "en")).toBe("Course certificate.pdf");
    expect(downloadName({ ...viewDoc, mime: "image/png" }, "ar")).toBe("شهادة دورة.png");
  });

  it("drops characters a file name or a header can't hold", () => {
    expect(downloadName({ ...viewDoc, titleEn: 'a/b\\\\c:"d"\r\n' }, "en")).toBe("a b c d.pdf");
    expect(downloadName({ ...viewDoc, titleEn: "///" }, "en")).toBe("document.pdf");
  });
});

/** A stand-in for the supabase-js query builder that records each filter. */
function recordingClient(result: { data: unknown; error: unknown }) {
  const filters: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "limit", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => {
      filters.push([method, ...args]);
      return method === "limit" || method === "maybeSingle" ? Promise.resolve(result) : builder;
    };
  }
  return { client: { from: (table: string) => { filters.push(["from", table]); return builder; } }, filters };
}

describe("the live-grant read", () => {
  it("asks only for this caller's granted, unexpired request, through their own client", async () => {
    const user = recordingClient({ data: [{ id: GRANT, expires_at: null }], error: null });
    const store = createDocumentOpenStore(user.client as never, {} as never, "user_client");
    expect(await store.liveGrant(DOC)).toBe(GRANT);
    expect(user.filters).toContainEqual(["from", "document_requests"]);
    expect(user.filters).toContainEqual(["eq", "document_id", DOC]);
    expect(user.filters).toContainEqual(["eq", "client_id", "user_client"]);
    // Expired, revoked and pending rows can't match.
    expect(user.filters).toContainEqual(["eq", "status", "granted"]);
    const or = user.filters.find(([method]) => method === "or");
    expect(or?.[1]).toMatch(/^expires_at\.is\.null,expires_at\.gt\.\d{4}-\d{2}-\d{2}T/);
  });

  it("answers null when nothing matches", async () => {
    const user = recordingClient({ data: [], error: null });
    const store = createDocumentOpenStore(user.client as never, {} as never, "user_client");
    expect(await store.liveGrant(DOC)).toBeNull();
  });
});

describe("deleteOldViewCopies (hourly)", () => {
  const NOW = new Date("2026-11-14T12:00:00.000Z");
  const object = (name: string, minutesAgo: number) => ({
    id: name,
    name,
    created_at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
  });

  function fakeStorage(pages: ReturnType<typeof object>[][]) {
    const removed: string[][] = [];
    let call = 0;
    const bucket = {
      list: vi.fn(async () => ({ data: pages[call++] ?? [], error: null })),
      remove: vi.fn(async (names: string[]) => {
        removed.push(names);
        return { data: [], error: null };
      }),
    };
    vi.mocked(createServiceClient).mockReturnValue({ storage: { from: vi.fn(() => bucket) } } as never);
    return { bucket, removed };
  }

  it("is in the document jobs", () => {
    expect(DOCUMENT_JOBS.map((job) => job.name)).toContain("deleteOldViewCopies");
  });

  it("deletes copies older than an hour and keeps the rest", async () => {
    const { bucket, removed } = fakeStorage([[object("a.pdf", 120), object("b.png", 61), object("c.pdf", 59), object("d.pdf", 1)]]);
    await deleteOldViewCopies(NOW);
    expect(removed).toEqual([["a.pdf", "b.png"]]);
    expect(bucket.list).toHaveBeenCalledTimes(1);
    expect(bucket.list).toHaveBeenCalledWith("", {
      limit: VIEW_COPY_PAGE_SIZE,
      sortBy: { column: "created_at", order: "asc" },
    });
  });

  it("reads another page only while a whole page was old", async () => {
    const full = Array.from({ length: VIEW_COPY_PAGE_SIZE }, (_, i) => object(`old-${i}.pdf`, 90));
    const { bucket, removed } = fakeStorage([full, [object("last.pdf", 80), object("new.pdf", 5)]]);
    await deleteOldViewCopies(NOW);
    expect(bucket.list).toHaveBeenCalledTimes(2);
    expect(removed[0]).toHaveLength(VIEW_COPY_PAGE_SIZE);
    expect(removed[1]).toEqual(["last.pdf"]);
  });

  it("deletes nothing when every copy is young", async () => {
    const { removed } = fakeStorage([[object("new.pdf", 10)]]);
    await deleteOldViewCopies(NOW);
    expect(removed).toEqual([]);
  });

  it("throws a short code when the list fails", async () => {
    const bucket = { list: vi.fn(async () => ({ data: null, error: { name: "StorageApiError", message: "row data" } })), remove: vi.fn() };
    vi.mocked(createServiceClient).mockReturnValue({ storage: { from: () => bucket } } as never);
    await expect(deleteOldViewCopies(NOW)).rejects.toThrow("document-views list failed (StorageApiError)");
  });
});

describe("DocumentOpenErrors messages", () => {
  it("has the same keys in Arabic and English", () => {
    expect(Object.keys(ar).toSorted()).toEqual(Object.keys(en).toSorted());
  });
});
