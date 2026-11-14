import { MAX_ATTACHMENT_BYTES, PERMISSIONS, type Consultation, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/AttachmentErrors.json";
import en from "@/messages/en/AttachmentErrors.json";
import {
  cleanupAttachments,
  SIGNED_UPLOAD_LIFETIME_MS,
  UNLINKED_MAX_AGE_MS,
  UPLOADING_MAX_AGE_MS,
  type CleanupDb,
} from "./cleanup";
import {
  attachmentKey,
  createAttachmentUploadUrl,
  downloadAttachment,
  finalizeAttachment,
  type AttachmentDeps,
} from "./handlers";
import type { AttachmentStore, PendingAttachment } from "./store";

vi.mock("server-only", () => ({}));

// The real byte detection from lib/admin/uploads, on small fake files.
const { detectMimeFromBytes } = await import("@/lib/admin/uploads/store");

const CONSULTATION = "11111111-1111-4111-8111-111111111111";
const CLOSED = "22222222-2222-4222-8222-222222222222";
const OTHER_CONSULTATION = "33333333-3333-4333-8333-333333333333";
const FILE = "44444444-4444-4444-8444-444444444444";
const NEW_FILE = "55555555-5555-4555-8555-555555555555";
const CLIENT = "user_client_a";
const OTHER_CLIENT = "user_client_b";
const ASSISTANT = "user_assistant";
const EDITOR = "user_editor";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\n%fake test file\n");
/** The first bytes of a Windows executable: "MZ", then the PE offset. */
const EXE_BYTES = (() => {
  const bytes = new Uint8Array(512);
  bytes.set([0x4d, 0x5a]);
  bytes.set([0x80, 0x00, 0x00, 0x00], 0x3c);
  bytes.set([0x50, 0x45, 0x00, 0x00], 0x80);
  return bytes;
})();

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function consultation(id: string, over: Partial<Consultation> = {}): Consultation {
  return {
    id,
    kind: "consultation",
    clientId: CLIENT,
    serviceId: null,
    title: "Test",
    description: "Fake",
    organization: null,
    status: "in_progress",
    assignedTo: ASSISTANT,
    firstReplyAt: null,
    closedAt: null,
    createdAt: "2026-11-14T10:00:00.000Z",
    ...over,
  };
}

type Row = PendingAttachment & { id: string; fileName: string; sizeBytes: number };

function world(viewer: string | null) {
  const permissions: Record<string, Permission[]> = {
    [ASSISTANT]: [PERMISSIONS.CONSULTATIONS_REPLY],
    [EDITOR]: [PERMISSIONS.CONTENT_MANAGE],
  };
  const all = [consultation(CONSULTATION), consultation(CLOSED, { status: "closed" }), consultation(OTHER_CONSULTATION, { clientId: OTHER_CLIENT, assignedTo: null })];
  // RLS: the client's own, or assigned to the caller.
  const visible = (item: Consultation) => item.clientId === viewer || item.assignedTo === viewer;
  const rows: Row[] = [];
  const objects = new Map<string, Uint8Array>();
  const removed: string[] = [];

  const consultations = {
    get: vi.fn(async (id: string) => all.find((item) => item.id === id && visible(item)) ?? null),
    hasPermission: vi.fn(async (key: Permission) => (viewer ? (permissions[viewer] ?? []).includes(key) : false)),
  };
  const attachments: AttachmentStore = {
    insertUploading: vi.fn(async (row) => {
      rows.push({ ...row, status: "uploading" });
    }),
    pending: vi.fn(async (id) => rows.find((row) => row.id === id) ?? null),
    markReady: vi.fn(async (id, size) => {
      const row = rows.find((item) => item.id === id && item.status === "uploading");
      if (!row) return false;
      row.status = "ready";
      row.sizeBytes = size;
      return true;
    }),
    deleteRow: vi.fn(async (id) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) rows.splice(index, 1);
    }),
    visible: vi.fn(async (id) => {
      const row = rows.find((item) => item.id === id);
      const parent = row && all.find((item) => item.id === row.consultationId);
      return row && parent && visible(parent) ? { status: row.status } : null;
    }),
    objectOf: vi.fn(async (id) => {
      const row = rows.find((item) => item.id === id);
      return row ? { storageKey: row.storageKey, fileName: row.fileName } : null;
    }),
    signDownload: vi.fn(async (key, fileName) => `https://storage.test/${key}?download=${encodeURIComponent(fileName)}`),
  };
  const storage = {
    signUpload: vi.fn(async (bucket: string, path: string) => `https://storage.test/upload/${bucket}/${path}?token=t`),
    open: vi.fn(async (_bucket: string, path: string) => {
      const bytes = objects.get(path);
      return bytes ? { size: bytes.length, stream: streamOf(bytes) } : null;
    }),
    remove: vi.fn(async (_bucket: string, path: string) => {
      objects.delete(path);
      removed.push(path);
    }),
  };
  const deps: AttachmentDeps = { locale: "en", userId: viewer, consultations, attachments, storage };

  /** An uploaded file waiting for finalize. */
  function uploaded(over: Partial<Row> = {}, bytes: Uint8Array = PDF_BYTES) {
    const row: Row = {
      id: FILE,
      consultationId: CONSULTATION,
      storageKey: attachmentKey(CONSULTATION, FILE, PDF_MIME),
      mime: PDF_MIME,
      status: "uploading",
      uploadedBy: CLIENT,
      fileName: "report.pdf",
      sizeBytes: bytes.length,
      ...over,
    };
    rows.push(row);
    objects.set(row.storageKey, bytes);
    return row;
  }

  return { deps, rows, objects, removed, storage, attachments, uploaded };
}

const PDF_FILE = { fileName: "report.pdf", mime: PDF_MIME, sizeBytes: 1_000_000 };

describe("upload-url", () => {
  const ask = (w: ReturnType<typeof world>, body: unknown, id = CONSULTATION) =>
    createAttachmentUploadUrl(id, body, w.deps, () => NEW_FILE);

  it("refuses a signed-out caller, and writes nothing", async () => {
    const w = world(null);
    expect((await ask(w, PDF_FILE)).status).toBe(401);
    expect(w.rows).toEqual([]);
  });

  it("writes an uploading row for the caller and signs a server-made key", async () => {
    const w = world(CLIENT);
    const result = await ask(w, PDF_FILE);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      attachmentId: NEW_FILE,
      url: `https://storage.test/upload/attachments/${CONSULTATION}/${NEW_FILE}.pdf?token=t`,
    });
    expect(w.rows).toEqual([
      expect.objectContaining({ id: NEW_FILE, status: "uploading", uploadedBy: CLIENT, consultationId: CONSULTATION, fileName: "report.pdf", sizeBytes: 1_000_000 }),
    ]);
  });

  it("refuses a type outside the allow-list, with the reason", async () => {
    const w = world(CLIENT);
    const result = await ask(w, { fileName: "setup.exe", mime: "application/x-msdownload", sizeBytes: 100 });
    expect(result).toEqual({ status: 415, body: { error: { code: "file_type_not_allowed", message: en.fileTypeNotAllowed } } });
    expect(w.rows).toEqual([]);
  });

  it("refuses a file over 10 MB, with the reason", async () => {
    const w = world(CLIENT);
    const result = await ask(w, { ...PDF_FILE, sizeBytes: MAX_ATTACHMENT_BYTES + 1 });
    expect(result).toEqual({ status: 413, body: { error: { code: "file_too_large", message: en.fileTooLarge } } });
    expect(w.rows).toEqual([]);
  });

  it.each([
    ["declared as DOCX", { fileName: "report.docm", mime: DOCX_MIME, sizeBytes: 100 }],
    ["declared as its own type", { fileName: "report.docm", mime: "application/vnd.ms-word.document.macroEnabled.12", sizeBytes: 100 }],
  ])("refuses a macro .docm %s", async (_label, body) => {
    const w = world(CLIENT);
    expect((await ask(w, body)).status).toBe(415);
    expect(w.rows).toEqual([]);
  });

  it("refuses another client's consultation as not found", async () => {
    const w = world(OTHER_CLIENT);
    expect((await ask(w, PDF_FILE)).status).toBe(404);
    expect(w.rows).toEqual([]);
  });

  it("refuses a member who sees it without consultations.reply", async () => {
    const w = world(EDITOR);
    const editorSees = world(EDITOR);
    // The editor sees nothing here (RLS): 404.
    expect((await ask(editorSees, PDF_FILE)).status).toBe(404);
    // Assigned to the editor, who holds no reply permission: 403.
    (w.deps.consultations.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(consultation(CONSULTATION, { assignedTo: EDITOR }));
    expect(await ask(w, PDF_FILE)).toEqual({ status: 403, body: { error: { code: "forbidden", message: en.forbidden } } });
    expect(w.rows).toEqual([]);
  });

  it("lets the assigned assistant upload", async () => {
    const w = world(ASSISTANT);
    expect((await ask(w, PDF_FILE)).status).toBe(200);
  });

  it("refuses a closed consultation with 409, in the user's language", async () => {
    const w = world(CLIENT);
    const result = await createAttachmentUploadUrl(CLOSED, PDF_FILE, { ...w.deps, locale: "ar" }, () => NEW_FILE);
    expect(result).toEqual({ status: 409, body: { error: { code: "conflict", message: ar.closed } } });
    expect(w.rows).toEqual([]);
  });

  it("removes the row again when signing fails", async () => {
    const w = world(CLIENT);
    w.storage.signUpload.mockRejectedValueOnce(new Error("storage down"));
    await expect(ask(w, PDF_FILE)).rejects.toThrow("storage down");
    expect(w.rows).toEqual([]);
  });
});

describe("finalize", () => {
  const finalize = (w: ReturnType<typeof world>, attachmentId = FILE, id = CONSULTATION) =>
    finalizeAttachment(id, { attachmentId }, w.deps, detectMimeFromBytes);

  it("refuses a signed-out caller", async () => {
    const w = world(null);
    w.uploaded();
    expect((await finalize(w)).status).toBe(401);
    expect(w.rows[0]!.status).toBe("uploading");
  });

  it("marks a real PDF ready with its real size, and links it to nothing", async () => {
    const w = world(CLIENT);
    w.uploaded();
    expect(await finalize(w)).toEqual({ status: 200, body: { ok: true } });
    expect(w.rows[0]).toMatchObject({ status: "ready", sizeBytes: PDF_BYTES.length });
    expect(w.removed).toEqual([]);
  });

  it("deletes a renamed .exe (wrong bytes) with its row, and says why", async () => {
    const w = world(CLIENT);
    const row = w.uploaded({}, EXE_BYTES);
    expect(await finalize(w)).toEqual({
      status: 415,
      body: { error: { code: "file_type_not_allowed", message: en.fileContentMismatch } },
    });
    expect(w.removed).toEqual([row.storageKey]);
    expect(w.rows).toEqual([]);
  });

  it("a detection error goes to the route: the object and row stay", async () => {
    const w = world(CLIENT);
    w.uploaded();
    const broken = vi.fn(async () => {
      throw new Error("storage read failed");
    });
    await expect(finalizeAttachment(CONSULTATION, { attachmentId: FILE }, w.deps, broken)).rejects.toThrow(
      "storage read failed",
    );
    expect(w.removed).toEqual([]);
    expect(w.rows[0]!.status).toBe("uploading");
  });

  it("deletes a file whose real size is over the limit", async () => {
    const w = world(CLIENT);
    const big = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    big.set(PDF_BYTES);
    w.uploaded({}, big);
    expect((await finalize(w)).status).toBe(413);
    expect(w.rows).toEqual([]);
    expect(w.removed).toHaveLength(1);
  });

  it("another user can't finalize the file: 404, nothing changes", async () => {
    const w = world(ASSISTANT);
    w.uploaded({ uploadedBy: CLIENT });
    expect((await finalize(w)).status).toBe(404);
    expect(w.rows[0]!.status).toBe("uploading");
    expect(w.removed).toEqual([]);
  });

  it("refuses a file id sent under another consultation", async () => {
    const w = world(CLIENT);
    w.uploaded({ consultationId: OTHER_CONSULTATION });
    (w.deps.consultations.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(consultation(CONSULTATION));
    expect((await finalize(w)).status).toBe(404);
    expect(w.rows[0]!.status).toBe("uploading");
  });

  it("answers 404 with its reason when nothing was uploaded", async () => {
    const w = world(CLIENT);
    w.uploaded();
    w.objects.clear();
    expect(await finalize(w)).toEqual({ status: 404, body: { error: { code: "not_found", message: en.uploadMissing } } });
  });

  it("finalizing twice is fine", async () => {
    const w = world(CLIENT);
    w.uploaded();
    await finalize(w);
    expect((await finalize(w)).status).toBe(200);
    expect(w.storage.open).toHaveBeenCalledTimes(1);
  });
});

describe("download", () => {
  const download = (w: ReturnType<typeof world>, id = FILE) => downloadAttachment(id, w.deps);

  it("refuses a signed-out caller", async () => {
    const w = world(null);
    w.uploaded({ status: "ready" });
    expect((await download(w)).status).toBe(401);
  });

  it("signs a download link under the file's name for someone who sees the consultation", async () => {
    const w = world(ASSISTANT);
    const row = w.uploaded({ status: "ready" });
    expect(await download(w)).toEqual({
      status: 200,
      body: { url: `https://storage.test/${row.storageKey}?download=report.pdf` },
    });
    expect(w.attachments.signDownload).toHaveBeenCalledWith(row.storageKey, "report.pdf");
  });

  it("another client can't download it: 404, nothing signed", async () => {
    const w = world(OTHER_CLIENT);
    w.uploaded({ status: "ready" });
    expect((await download(w)).status).toBe(404);
    expect(w.attachments.signDownload).not.toHaveBeenCalled();
    expect(w.attachments.objectOf).not.toHaveBeenCalled();
  });

  it("refuses a file still uploading", async () => {
    const w = world(CLIENT);
    w.uploaded();
    expect((await download(w)).status).toBe(409);
    expect(w.attachments.signDownload).not.toHaveBeenCalled();
  });
});

describe("cleanupAttachments", () => {
  type Stored = { key: string; status: "uploading" | "ready"; messageId: string | null; createdAt: number };
  const NOW = Date.parse("2026-11-14T12:00:00Z");

  function db(rows: Stored[]): CleanupDb & { rows: Stored[]; removed: string[] } {
    const removed: string[] = [];
    return {
      rows,
      removed,
      deleteAbandoned: async ({ uploading, unlinked }) => {
        const gone = rows.filter(
          (row) =>
            (row.status === "uploading" && row.createdAt < Date.parse(uploading)) ||
            (row.status === "ready" && row.messageId === null && row.createdAt < Date.parse(unlinked)),
        );
        for (const row of gone) rows.splice(rows.indexOf(row), 1);
        return gone.map((row) => row.key);
      },
      removeObjects: async (keys) => {
        removed.push(...keys);
      },
    };
  }

  it("deletes only stale uploads and old unlinked files, rows and objects", async () => {
    const minute = 60_000;
    const fake = db([
      { key: "stale-upload", status: "uploading", messageId: null, createdAt: NOW - UPLOADING_MAX_AGE_MS - minute },
      { key: "fresh-upload", status: "uploading", messageId: null, createdAt: NOW - UPLOADING_MAX_AGE_MS + minute },
      { key: "old-unlinked", status: "ready", messageId: null, createdAt: NOW - UNLINKED_MAX_AGE_MS - minute },
      { key: "young-unlinked", status: "ready", messageId: null, createdAt: NOW - UNLINKED_MAX_AGE_MS + minute },
      { key: "old-linked", status: "ready", messageId: "m1", createdAt: NOW - 30 * UNLINKED_MAX_AGE_MS },
    ]);
    expect(await cleanupAttachments(fake, NOW)).toEqual({ deleted: 2 });
    expect(fake.removed.sort()).toEqual(["old-unlinked", "stale-upload"]);
    expect(fake.rows.map((row) => row.key).sort()).toEqual(["fresh-upload", "old-linked", "young-unlinked"]);
  });

  it("keeps an upload whose signed URL may still write the object", async () => {
    expect(UPLOADING_MAX_AGE_MS).toBeGreaterThan(SIGNED_UPLOAD_LIFETIME_MS);
    const fake = db([
      { key: "url-still-live", status: "uploading", messageId: null, createdAt: NOW - SIGNED_UPLOAD_LIFETIME_MS + 60_000 },
      { key: "url-just-expired", status: "uploading", messageId: null, createdAt: NOW - SIGNED_UPLOAD_LIFETIME_MS },
    ]);
    expect(await cleanupAttachments(fake, NOW)).toEqual({ deleted: 0 });
    expect(fake.removed).toEqual([]);
  });

  it("is safe to run twice", async () => {
    const fake = db([{ key: "stale", status: "uploading", messageId: null, createdAt: NOW - 2 * UPLOADING_MAX_AGE_MS }]);
    await cleanupAttachments(fake, NOW);
    expect(await cleanupAttachments(fake, NOW)).toEqual({ deleted: 0 });
    expect(fake.removed).toEqual(["stale"]);
  });

  it("passes the two cutoffs as UTC times", async () => {
    const deleteAbandoned = vi.fn(async () => []);
    await cleanupAttachments({ deleteAbandoned, removeObjects: async () => {} }, NOW);
    expect(deleteAbandoned).toHaveBeenCalledWith({
      uploading: "2026-11-14T09:55:00.000Z",
      unlinked: "2026-11-13T12:00:00.000Z",
    });
  });
});
