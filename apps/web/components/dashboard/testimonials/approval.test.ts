import { describe, expect, it, vi } from "vitest";
import { sendApproval } from "./approval";

const ID = "6f9c2a7e-1b2d-4c3e-8f4a-5b6c7d8e9f01";

describe("sendApproval", () => {
  it("sends only { approved } to the entity's approve route", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
    expect(await sendApproval("testimonials", ID, true, fetchImpl)).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(`/api/admin/testimonials/${ID}/approve`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });
    await sendApproval("partners", ID, false, fetchImpl);
    expect(fetchImpl.mock.calls[1][0]).toBe(`/api/admin/partners/${ID}/approve`);
    expect(fetchImpl.mock.calls[1][1]?.body).toBe(JSON.stringify({ approved: false }));
  });

  it("returns the server's message on a refusal", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: { code: "forbidden", message: "Not allowed." } }), {
          status: 403,
        }),
    );
    expect(await sendApproval("testimonials", ID, true, fetchImpl)).toEqual({
      ok: false,
      message: "Not allowed.",
    });
  });

  it("fails without a message when the network fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("offline");
    });
    expect(await sendApproval("testimonials", ID, true, fetchImpl)).toEqual({
      ok: false,
      message: null,
    });
  });
});
