import { errorResponseSchema } from "@repo/shared";
import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  /** When set, the check never answers until `release` is called. */
  hangs: false,
  release: [] as Array<(outcome: boolean | Error) => void>,
  calls: [] as string[],
}));

vi.mock("./lib/content", () => {
  const check = (type: string) => async (slug: string, locale: string) => {
    const key = `${type}/${locale}/${slug}`;
    lookup.calls.push(key);
    if (lookup.hangs) {
      return new Promise<boolean>((resolve, reject) => {
        lookup.release.push((outcome) =>
          typeof outcome === "boolean" ? resolve(outcome) : reject(outcome),
        );
      });
    }
    if (lookup.fails) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
    return lookup.public.has(key);
  };
  return {
    hasService: check("services"),
    hasProject: check("projects"),
    hasExpertiseArea: check("expertise"),
  };
});

const { default: proxy, DETAIL_LOOKUP_TIMEOUT_MS } = await import("./proxy");

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
  lookup.hangs = false;
  lookup.release = [];
  lookup.calls = [];
});

afterEach(() => {
  vi.useRealTimers();
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
  ])("sends a missing or unpublished %s to the not-found page", async (path, locale) => {
    const response = await request(path);
    // The page it rewrites to sets the 404. A status set here would make
    // Vercel answer with its own bare 404 page.
    expect(response.status).toBe(200);
    expect(rewrittenTo(response)).toBe(`${ORIGIN}/${locale}/not-found`);
  });

  it("answers a page that isn't in this language the same way", async () => {
    const missing = await request("/ar/services/no-such-service");
    const otherLanguage = await request("/ar/services/english-only");
    expect(rewrittenTo(missing)).toBe(`${ORIGIN}/ar/not-found`);
    expect(rewrittenTo(otherLanguage)).toBe(rewrittenTo(missing));
    expect(otherLanguage.status).toBe(missing.status);
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
    expect(rewrittenTo(response) ?? "").not.toMatch(/\/not-found$/);
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

  it.each([
    "/en/services/no-such-service",
    "/ar/projects/no-such-project",
    "/en/expertise/no-such-area",
    "/en/services/governance-review",
  ])("passes %s on when the lookup outlasts the timeout", async (path) => {
    vi.useFakeTimers();
    lookup.hangs = true;
    let settled = false;
    const pending = request(path).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(DETAIL_LOOKUP_TIMEOUT_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(lookup.calls).toHaveLength(1);
    expect(response.status).toBe(200);
    expect(rewrittenTo(response)).toBeNull();
  });

  it.each([
    ["answers", false],
    ["fails", new Error("late")],
  ])("ignores a lookup that %s after the timeout", async (_name, outcome) => {
    vi.useFakeTimers();
    lookup.hangs = true;
    const pending = request("/en/services/no-such-service");
    await vi.advanceTimersByTimeAsync(DETAIL_LOOKUP_TIMEOUT_MS);
    const response = await pending;

    lookup.release.forEach((release) => release(outcome));
    await vi.runAllTimersAsync();
    expect(response.status).toBe(200);
    expect(rewrittenTo(response)).toBeNull();
  });

  it("still sends a missing page to the not-found page when the lookup answers just inside the timeout", async () => {
    vi.useFakeTimers();
    lookup.hangs = true;
    const pending = request("/en/services/no-such-service");
    await vi.advanceTimersByTimeAsync(DETAIL_LOOKUP_TIMEOUT_MS - 1);
    lookup.release.forEach((release) => release(false));
    expect(rewrittenTo(await pending)).toBe(`${ORIGIN}/en/not-found`);
  });

  it.each(["/en/services/governance-review", "/en/services/no-such-service"])(
    "leaves no timer running after the lookup for %s",
    async (path) => {
      vi.useFakeTimers();
      await request(path);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("leaves no timer running when the lookup fails", async () => {
    vi.useFakeTimers();
    lookup.fails = true;
    await request("/en/services/no-such-service");
    expect(vi.getTimerCount()).toBe(0);
  });
});
