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

/** Each check answers from this list of public "type/locale/slug" keys, or throws. */
const lookup = vi.hoisted(() => ({
  public: new Set<string>(),
  fails: false,
  calls: [] as string[],
}));

vi.mock("./lib/content", () => {
  const check = (type: string) => async (slug: string, locale: string) => {
    const key = `${type}/${locale}/${slug}`;
    lookup.calls.push(key);
    if (lookup.fails) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
    return lookup.public.has(key);
  };
  return {
    hasService: check("services"),
    hasProject: check("projects"),
    hasExpertiseArea: check("expertise"),
  };
});

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
  lookup.public = new Set([
    "services/en/governance-review",
    "services/ar/governance-review",
    "services/en/english-only",
    "projects/ar/school-program",
    "expertise/en/governance",
    "services/ar/حوكمة",
  ]);
  lookup.fails = false;
  lookup.calls = [];
});

/** How Next reports a rewrite: the target URL in this header. */
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");

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

describe("detail pages", () => {
  it.each([
    ["/en/services/no-such-service", "en"],
    ["/ar/services/no-such-service", "ar"],
    ["/en/projects/no-such-project", "en"],
    ["/ar/projects/no-such-project", "ar"],
    ["/en/expertise/no-such-area", "en"],
    ["/ar/expertise/no-such-area", "ar"],
  ])("answers a missing or unpublished %s with a 404", async (path, locale) => {
    const response = await request(path);
    expect(response.status).toBe(404);
    expect(rewrittenTo(response)).toBe(`${ORIGIN}/${locale}/not-found`);
  });

  it("answers a page that isn't in this language the same way", async () => {
    const missing = await request("/ar/services/no-such-service");
    const otherLanguage = await request("/ar/services/english-only");
    expect(otherLanguage.status).toBe(404);
    expect(rewrittenTo(otherLanguage)).toBe(rewrittenTo(missing));
    expect([...otherLanguage.headers.keys()].sort()).toEqual([...missing.headers.keys()].sort());
  });

  it.each([
    "/en/services/governance-review",
    "/ar/services/governance-review",
    "/en/services/english-only",
    "/ar/projects/school-program",
    "/en/expertise/governance",
  ])("serves the published %s as it is", async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(rewrittenTo(response)).toBeNull();
  });

  it("looks up the slug decoded, as the page reads it", async () => {
    const response = await request(`/ar/services/${encodeURIComponent("حوكمة")}`);
    expect(response.status).toBe(200);
    expect(lookup.calls).toEqual(["services/ar/حوكمة"]);
  });

  it.each([
    "/en/services",
    "/ar/projects",
    "/en/expertise",
    "/en",
    "/en/about",
    "/en/no-such-page",
    "/en/services/governance-review/extra",
    "/en/faq/no-such-service",
    "/services/no-such-service",
    "/api/contact",
    "/api/services/no-such-service",
  ])("does no lookup for %s", async (path) => {
    const response = await request(path);
    expect(response.status).not.toBe(404);
    expect(lookup.calls).toEqual([]);
  });

  it("does no lookup for a protected page", async () => {
    const response = await request("/en/dashboard/services/no-such-service");
    expect(response.status).toBe(307);
    expect(lookup.calls).toEqual([]);
  });

  it.each([
    "/en/services/no-such-service",
    "/ar/projects/no-such-project",
    "/en/expertise/no-such-area",
    "/en/services/governance-review",
  ])("passes %s on when the lookup fails", async (path) => {
    lookup.fails = true;
    const response = await request(path);
    expect(lookup.calls).toHaveLength(1);
    expect(response.status).toBe(200);
    expect(rewrittenTo(response)).toBeNull();
  });
});
