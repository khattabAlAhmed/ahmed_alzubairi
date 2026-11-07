import { fileTypeFromStream } from "file-type";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en/AdminErrors.json";
import {
  EXE_BYTES,
  PDF_BYTES,
  PNG_BYTES,
  streamOf,
  SVG_BYTES,
} from "./fixtures";
import {
  createUploadUrl,
  finalizeUpload,
  permissionForBody,
  type DetectMime,
  type UploadStore,
} from "./handlers";

const UUID = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const MB = 1024 * 1024;

const detect: DetectMime = async (stream) =>
  (await fileTypeFromStream(stream))?.mime;

function store(file?: { bytes: Uint8Array; size?: number }): UploadStore {
  return {
    signUpload: vi.fn(
      async (bucket: string, path: string) =>
        `https://example.supabase.co/storage/v1/object/upload/sign/${bucket}/${path}?token=t`,
    ),
    open: vi.fn(async () =>
      file
        ? { size: file.size ?? file.bytes.length, stream: streamOf(file.bytes) }
        : null,
    ),
    move: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
}

const deps = (s: UploadStore) => ({ locale: "en" as const, store: s });

describe("upload-url", () => {
  const png = {
    target: "media",
    fileName: "Logo.PNG",
    mime: "image/png",
    sizeBytes: 2048,
  };

  it("signs a server-made key in the target's bucket", async () => {
    const s = store();
    const result = await createUploadUrl(png, deps(s), () => UUID);
    expect(result).toEqual({
      status: 200,
      body: {
        url: expect.stringContaining("/public-media/pending/"),
        key: `pending/${UUID}.png`,
      },
    });
    expect(s.signUpload).toHaveBeenCalledWith(
      "public-media",
      `pending/${UUID}.png`,
    );
  });

  it.each([
    ["document", "documents"],
    ["resource", "resources"],
    ["letter", "internal"],
  ] as const)("maps %s to the %s bucket", async (target, bucket) => {
    const s = store();
    const body = { target, fileName: "a.pdf", mime: "application/pdf", sizeBytes: 9 };
    await createUploadUrl(body, deps(s), () => UUID);
    expect(s.signUpload).toHaveBeenCalledWith(bucket, `pending/${UUID}.pdf`);
  });

  it("refuses a declared type the target doesn't take", async () => {
    const s = store();
    const result = await createUploadUrl(
      { ...png, target: "resource" },
      deps(s),
    );
    expect(result).toMatchObject({
      status: 415,
      body: { error: { code: "file_type_not_allowed", message: en.fileTypeNotAllowed } },
    });
    expect(s.signUpload).not.toHaveBeenCalled();
  });

  it("refuses an SVG to media", async () => {
    const result = await createUploadUrl(
      { ...png, fileName: "logo.svg", mime: "image/svg+xml" },
      deps(store()),
    );
    expect(result).toMatchObject({
      status: 415,
      body: { error: { code: "file_type_not_allowed" } },
    });
  });

  it("refuses a macro format such as .docm", async () => {
    const result = await createUploadUrl(
      {
        target: "resource",
        fileName: "plan.docm",
        mime: "application/vnd.ms-word.document.macroEnabled.12",
        sizeBytes: 100,
      },
      deps(store()),
    );
    expect(result).toMatchObject({ status: 415 });
  });

  it("refuses a name whose extension doesn't match the declared type", async () => {
    const result = await createUploadUrl(
      { ...png, fileName: "setup.exe" },
      deps(store()),
    );
    expect(result).toMatchObject({
      status: 415,
      body: { error: { code: "file_type_not_allowed" } },
    });
  });

  it("refuses a file that is too big", async () => {
    const result = await createUploadUrl(
      { ...png, sizeBytes: 10 * MB + 1 },
      deps(store()),
    );
    expect(result).toMatchObject({
      status: 413,
      body: { error: { code: "file_too_large", message: en.fileTooLarge } },
    });
  });

  it.each([
    ["a client-chosen key", { key: "public/logo.png" }],
    ["a client-chosen path", { path: "../documents/x.pdf" }],
  ])("refuses %s", async (_label, extra) => {
    const s = store();
    const result = await createUploadUrl({ ...png, ...extra }, deps(s));
    expect(result).toMatchObject({
      status: 400,
      body: { error: { code: "validation_failed" } },
    });
    expect(s.signUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["no body", undefined],
    ["an unknown target", { ...png, target: "attachments" }],
    ["a zero size", { ...png, sizeBytes: 0 }],
    ["an empty name", { ...png, fileName: " " }],
  ])("refuses %s", async (_label, body) => {
    const result = await createUploadUrl(body, deps(store()));
    expect(result).toMatchObject({ status: 400 });
  });
});

describe("finalize", () => {
  const pngKey = `pending/${UUID}.png`;
  const pdfKey = `pending/${UUID}.pdf`;

  it("passes a real PNG to media and moves it out of pending", async () => {
    const s = store({ bytes: PNG_BYTES });
    const result = await finalizeUpload(
      { target: "media", key: pngKey },
      deps(s),
      detect,
    );
    expect(result).toEqual({ status: 200, body: { key: `${UUID}.png` } });
    expect(s.open).toHaveBeenCalledWith("public-media", pngKey);
    expect(s.move).toHaveBeenCalledWith("public-media", pngKey, `${UUID}.png`);
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("passes a real PDF to document", async () => {
    const s = store({ bytes: PDF_BYTES });
    const result = await finalizeUpload(
      { target: "document", key: pdfKey },
      deps(s),
      detect,
    );
    expect(result).toEqual({ status: 200, body: { key: `${UUID}.pdf` } });
    expect(s.move).toHaveBeenCalledWith("documents", pdfKey, `${UUID}.pdf`);
  });

  it("refuses an .exe named .pdf and deletes it", async () => {
    const s = store({ bytes: EXE_BYTES });
    const result = await finalizeUpload(
      { target: "document", key: pdfKey },
      deps(s),
      detect,
    );
    expect(result).toMatchObject({
      status: 415,
      body: { error: { code: "file_type_not_allowed" } },
    });
    expect(s.remove).toHaveBeenCalledWith("documents", pdfKey);
    expect(s.move).not.toHaveBeenCalled();
  });

  it("refuses a PDF uploaded under a PNG key and deletes it", async () => {
    const s = store({ bytes: PDF_BYTES });
    const result = await finalizeUpload(
      { target: "media", key: pngKey },
      deps(s),
      detect,
    );
    expect(result).toMatchObject({ status: 415 });
    expect(s.remove).toHaveBeenCalledWith("public-media", pngKey);
  });

  it("refuses SVG bytes to media and deletes them", async () => {
    const s = store({ bytes: SVG_BYTES });
    const result = await finalizeUpload(
      { target: "media", key: pngKey },
      deps(s),
      detect,
    );
    expect(result).toMatchObject({ status: 415 });
    expect(s.remove).toHaveBeenCalledWith("public-media", pngKey);
  });

  it("refuses a file whose real size is too big and deletes it", async () => {
    const s = store({ bytes: PNG_BYTES, size: 10 * MB + 1 });
    const result = await finalizeUpload(
      { target: "media", key: pngKey },
      deps(s),
      detect,
    );
    expect(result).toMatchObject({
      status: 413,
      body: { error: { code: "file_too_large" } },
    });
    expect(s.remove).toHaveBeenCalledWith("public-media", pngKey);
    expect(s.move).not.toHaveBeenCalled();
  });

  it("refuses when the type check throws, and deletes the file", async () => {
    const s = store({ bytes: PNG_BYTES });
    const result = await finalizeUpload(
      { target: "media", key: pngKey },
      deps(s),
      async () => {
        throw new Error("bad stream");
      },
    );
    expect(result).toMatchObject({ status: 415 });
    expect(s.remove).toHaveBeenCalled();
  });

  it("is not found when nothing was uploaded", async () => {
    const s = store();
    const result = await finalizeUpload(
      { target: "media", key: pngKey },
      deps(s),
      detect,
    );
    expect(result).toMatchObject({
      status: 404,
      body: { error: { code: "not_found", message: en.uploadNotFound } },
    });
    expect(s.remove).not.toHaveBeenCalled();
  });

  it.each([
    ["a client-chosen key", "logo.png"],
    ["a final key", `${UUID}.png`],
    ["a path into another folder", `pending/../${UUID}.png`],
    ["an extension media doesn't take", `pending/${UUID}.docx`],
  ])("refuses %s without touching Storage", async (_label, key) => {
    const s = store({ bytes: PNG_BYTES });
    const result = await finalizeUpload(
      { target: "media", key },
      deps(s),
      detect,
    );
    expect(result).toMatchObject({
      status: 400,
      body: { error: { code: "validation_failed" } },
    });
    expect(s.open).not.toHaveBeenCalled();
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("refuses a body with extra fields", async () => {
    const result = await finalizeUpload(
      { target: "media", key: pngKey, bucket: "documents" },
      deps(store({ bytes: PNG_BYTES })),
      detect,
    );
    expect(result).toMatchObject({ status: 400 });
  });
});

describe("permission per target", () => {
  it.each([
    [{ target: "document" }, "documents.manage"],
    [{ target: "resource" }, "content.manage"],
    [{ target: "media" }, "content.manage"],
    [{ target: "letter" }, "content.manage"],
    [{ target: "nope" }, "content.manage"],
    [undefined, "content.manage"],
  ])("%j needs %s", (body, permission) => {
    expect(permissionForBody(body)).toBe(permission);
  });
});
