import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn(async () => ({ isAuthenticated: false })));

type Handler = (auth: () => Promise<{ isAuthenticated: boolean }>, request: NextRequest) => Promise<Response>;

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: Handler) => (request: NextRequest) => handler(auth, request),
}));

vi.mock("@/lib/content", () => ({
  hasService: async () => true,
  hasProject: async () => true,
  hasExpertiseArea: async () => true,
}));

const { default: proxy } = await import("@/proxy");

function request(path: string) {
  return proxy(
    new NextRequest(new URL(path, "http://localhost:3000"), { method: "POST" }),
    {} as NextFetchEvent,
  ) as Promise<Response>;
}

/** Clerk's servers carry no session: the route's signature check protects it. */
describe("the proxy and the Clerk webhook", () => {
  it("lets /api/clerk/webhook through without a session, and never asks for one", async () => {
    const response = await request("/api/clerk/webhook");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(auth).not.toHaveBeenCalled();
  });

  it.each([
    "/api/profile",
    "/api/admin/team",
    "/api/clerk",
    "/api/clerk/webhook/extra",
    "/api/clerk/webhooks",
    "/api/clerk/other",
  ])("still refuses %s without a session", async (path) => {
    const response = await request(path);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  });
});
