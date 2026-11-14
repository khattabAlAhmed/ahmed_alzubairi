import { beforeEach, describe, expect, it, vi } from "vitest";
// No referer, so the answer is in Arabic, the default.
import ar from "@/messages/ar.json";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createUserClient: vi.fn(() => {
    throw new Error("no database for a signed-out caller");
  }),
  createServiceClient: vi.fn(() => {
    throw new Error("no database for a signed-out caller");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: mocks.createUserClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));

const uploadUrl = await import("@/app/api/consultations/[id]/attachments/upload-url/route");
const finalize = await import("@/app/api/consultations/[id]/attachments/finalize/route");
const download = await import("@/app/api/attachments/[id]/route");

const ID = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: ID }) };
const post = (path: string, body: unknown) =>
  new Request(`https://x.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: null });
  mocks.createUserClient.mockClear();
  mocks.createServiceClient.mockClear();
});

describe("attachment routes, signed out", () => {
  it.each([
    [
      "POST upload-url",
      () =>
        uploadUrl.POST(
          post(`/api/consultations/${ID}/attachments/upload-url`, { fileName: "a.pdf", mime: "application/pdf", sizeBytes: 10 }),
          context,
        ),
    ],
    ["POST finalize", () => finalize.POST(post(`/api/consultations/${ID}/attachments/finalize`, { attachmentId: ID }), context)],
    ["GET /api/attachments/:id", () => download.GET(new Request(`https://x.test/api/attachments/${ID}`), context)],
  ])("%s answers 401 and touches no database or storage", async (_label, call) => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated", message: ar.Errors.unauthenticated },
    });
    expect(mocks.createUserClient).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("answers 500 with the base message when a store throws", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_client_a" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await download.GET(new Request(`https://x.test/api/attachments/${ID}`), context);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: ar.Errors.internal_error },
    });
    spy.mockRestore();
  });
});
