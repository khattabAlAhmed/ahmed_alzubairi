import { errorResponseSchema } from "@repo/shared";
import { NextRequest, type NextFetchEvent } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ isAuthenticated: false }));

type Handler = (
  auth: () => Promise<typeof session>,
  request: NextRequest,
) => Promise<Response>;

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: Handler) => (request: NextRequest) =>
      handler(async () => session, request),
}));

const { default: proxy } = await import("./proxy");

const ORIGIN = "http://localhost:3000";

function request(path: string, headers?: HeadersInit) {
  return proxy(
    new NextRequest(new URL(path, ORIGIN), { headers }),
    {} as NextFetchEvent,
  ) as Promise<Response>;
}

beforeEach(() => {
  session.isAuthenticated = false;
});

describe("language routing", () => {
  it("redirects / to /ar, whatever the browser asks for", async () => {
    const response = await request("/", { "accept-language": "en-US" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/ar`);
  });

  it("sends a path with no language to the Arabic one", async () => {
    const response = await request("/about");
    expect(response.headers.get("location")).toBe(`${ORIGIN}/ar/about`);
  });

  it.each(["/ar", "/en", "/en/about"])("serves %s as it is", async (path) => {
    const response = await request(path);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("protected pages", () => {
  it.each([
    ["/ar/account", "%2Far%2Faccount", "ar"],
    ["/ar/dashboard", "%2Far%2Fdashboard", "ar"],
    ["/en/onboarding", "%2Fen%2Fonboarding", "en"],
    ["/ar/%61ccount", "%2Far%2F%2561ccount", "ar"],
  ])("sends a signed-out %s to sign-in", async (path, encoded, locale) => {
    const response = await request(path);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/${locale}/sign-in?redirect_url=${encoded}`,
    );
  });

  it("keeps the query in the return path", async () => {
    const response = await request("/en/account?tab=open");
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/en/sign-in?redirect_url=%2Fen%2Faccount%3Ftab%3Dopen`,
    );
  });

  it("serves them to a signed-in user", async () => {
    session.isAuthenticated = true;
    const response = await request("/ar/account");
    expect(response.headers.get("location")).toBeNull();
  });

  it("refuses a path it can't decode", async () => {
    expect((await request("/ar/%E0%A4%A")).status).toBe(400);
  });
});

describe("API routes", () => {
  it("refuses a signed-out request with a 401 and the error shape", async () => {
    const response = await request("/api/profile");
    expect(response.status).toBe(401);
    const body = errorResponseSchema.parse(await response.json());
    expect(body.error.code).toBe("unauthenticated");
  });

  it("answers in the language of the referring page", async () => {
    const response = await request("/api/profile", {
      referer: `${ORIGIN}/en/account`,
    });
    const body = errorResponseSchema.parse(await response.json());
    expect(body.error.message).toBe("Please sign in to continue.");
  });

  it("lets a signed-in user through", async () => {
    session.isAuthenticated = true;
    expect((await request("/api/profile")).status).toBe(200);
  });

  it("leaves public routes public", async () => {
    expect((await request("/api/contact")).status).toBe(200);
  });
});
