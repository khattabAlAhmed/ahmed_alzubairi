import { describe, expect, it, vi } from "vitest";
import { acceptFor, mediaUrl, uploadFile, UploadError } from "./upload";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("uploadFile", () => {
  it("asks for a URL, sends the file, finalizes, and returns the key", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ url: "https://storage.test/upload?token=t", key: "services/a.png" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ key: "services/a.png" }));
    const file = new File(["png"], "a.png", { type: "image/png" });

    await expect(uploadFile(file, "media", fetchImpl)).resolves.toBe("services/a.png");

    const [first, second, third] = fetchImpl.mock.calls;
    expect(first[0]).toBe("/api/admin/uploads/upload-url");
    expect(JSON.parse(String(first[1]?.body))).toEqual({
      target: "media",
      fileName: "a.png",
      mime: "image/png",
      sizeBytes: 3,
    });
    expect(second[0]).toBe("https://storage.test/upload?token=t");
    expect(second[1]?.method).toBe("PUT");
    expect(third[0]).toBe("/api/admin/uploads/finalize");
    expect(JSON.parse(String(third[1]?.body))).toEqual({ target: "media", key: "services/a.png" });
  });

  it("carries the server's localized message when a step is refused", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { code: "forbidden", message: "Not allowed" } }, 403));
    const error = await uploadFile(new File(["x"], "x.png", { type: "image/png" }), "media", fetchImpl).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(UploadError);
    expect((error as UploadError).serverMessage).toBe("Not allowed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails without a message when Storage refuses the file", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ url: "https://storage.test/u", key: "k" }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }));
    const error = await uploadFile(new File(["x"], "x.png", { type: "image/png" }), "media", fetchImpl).catch(
      (caught: unknown) => caught,
    );
    expect((error as UploadError).serverMessage).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("upload helpers", () => {
  it("offers images only for image fields", () => {
    expect(acceptFor("media", true)).toBe("image/jpeg,image/png");
    expect(acceptFor("resource", false)).toBe(".pdf,.docx,.xlsx");
  });

  it("encodes each part of a media key", () => {
    expect(mediaUrl("https://x.test/public-media/", "a b/c.png")).toBe("https://x.test/public-media/a%20b/c.png");
  });
});
