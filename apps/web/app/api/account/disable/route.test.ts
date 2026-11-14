import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "user_client" as string | null,
  disableAccount: vi.fn(),
  createClientStore: vi.fn(() => ({ store: true })),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
  clerkClient: vi.fn(),
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: () => "user-client" }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => "service-client" }));
vi.mock("@/lib/admin/clients/store", () => ({ createClientStore: mocks.createClientStore }));
vi.mock("@/lib/profile/disable", () => ({ disableAccount: mocks.disableAccount }));

const { POST } = await import("./route");

const request = (body: unknown) =>
  new Request("https://site.example/api/account/disable", {
    method: "POST",
    headers: { "content-type": "application/json", referer: "https://site.example/ar/account/profile" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.userId = "user_client";
  mocks.disableAccount.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/account/disable", () => {
  it("passes the session's user, the caller's language and both clients", async () => {
    mocks.disableAccount.mockResolvedValue({ status: 200, body: { ok: true, closedConsultations: 1 } });
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, closedConsultations: 1 });
    const deps = mocks.disableAccount.mock.calls[0][0];
    expect(deps).toMatchObject({ userId: "user_client", locale: "ar" });
    expect(await deps.readBody()).toEqual({});
    expect(mocks.createClientStore).toHaveBeenCalledWith("user-client", "service-client");
  });

  it("passes a signed-out caller as null", async () => {
    mocks.userId = null;
    mocks.disableAccount.mockResolvedValue({
      status: 401,
      body: { error: { code: "unauthenticated", message: "x" } },
    });
    const response = await POST(request({}));
    expect(response.status).toBe(401);
    expect(mocks.disableAccount.mock.calls[0][0].userId).toBeNull();
  });

  it("answers 500 with no detail when something throws", async () => {
    mocks.disableAccount.mockRejectedValue(new Error("disable_client failed: 57014"));
    const response = await POST(request({}));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("57014");
  });
});
