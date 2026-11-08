import { describe, expect, it, vi } from "vitest";
import { saveContent } from "./save";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("saveContent", () => {
  it("creates with POST and returns the new id", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ id: "new-id" }, 201));
    await expect(saveContent("services", { status: "draft" }, true, fetchImpl)).resolves.toEqual({
      ok: true,
      id: "new-id",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/admin/content/services",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "draft" }) }),
    );
  });

  it("updates with PATCH", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true }));
    await expect(saveContent("faqs", { id: "x" }, false, fetchImpl)).resolves.toEqual({ ok: true, id: null });
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("PATCH");
  });

  it("returns the server's message when it refuses to publish", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ error: { code: "validation_failed", message: "Needs a language" } }, 422));
    await expect(saveContent("services", {}, false, fetchImpl)).resolves.toEqual({
      ok: false,
      status: 422,
      message: "Needs a language",
    });
  });

  it("reports a network failure without a message", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    await expect(saveContent("services", {}, true, fetchImpl)).resolves.toEqual({
      ok: false,
      status: 0,
      message: null,
    });
  });
});
