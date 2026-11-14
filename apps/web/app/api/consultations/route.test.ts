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

const list = await import("./route");
const one = await import("./[id]/route");
const messages = await import("./[id]/messages/route");

const ID = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: ID }) };
const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: null });
  mocks.createUserClient.mockClear();
  mocks.createServiceClient.mockClear();
});

describe("consultation routes, signed out", () => {
  it.each([
    ["GET /api/consultations", () => list.GET(new Request("https://x.test/api/consultations"))],
    [
      "POST /api/consultations",
      () =>
        list.POST(
          new Request("https://x.test/api/consultations", json({ serviceId: ID, title: "t", description: "d" })),
        ),
    ],
    ["GET /api/consultations/:id", () => one.GET(new Request(`https://x.test/api/consultations/${ID}`), context)],
    [
      "POST /api/consultations/:id/messages",
      () => messages.POST(new Request(`https://x.test/api/consultations/${ID}/messages`, json({ body: "Hi" })), context),
    ],
  ])("%s answers 401 and touches no database", async (_label, call) => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated", message: ar.Errors.unauthenticated },
    });
    expect(mocks.createUserClient).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});

describe("consultation routes, failures", () => {
  it("answers 500 with the base message when the store throws, never the error text", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_client_a" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await list.GET(new Request("https://x.test/api/consultations"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: ar.Errors.internal_error },
    });
    spy.mockRestore();
  });
});
