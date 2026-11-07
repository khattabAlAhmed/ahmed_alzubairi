import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn<() => Promise<string | null>>();

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ getToken })),
}));

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const PUBLISHABLE_VAR = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const fetchMock = vi.fn<typeof fetch>();

function lastRequestHeaders(): Headers {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("No request was sent");
  const [input, init] = call;
  return new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createUserClient", () => {
  beforeEach(() => {
    vi.stubEnv(URL_VAR, "https://project.supabase.co");
    vi.stubEnv(PUBLISHABLE_VAR, "sb_publishable_test");
  });

  it("sends the user's Clerk session token, so RLS applies", async () => {
    getToken.mockResolvedValue("clerk-session-token");
    const { createUserClient } = await import("./user");

    await createUserClient().from("profiles").select("clerk_user_id");

    const headers = lastRequestHeaders();
    expect(headers.get("authorization")).toBe("Bearer clerk-session-token");
    expect(headers.get("apikey")).toBe("sb_publishable_test");
  });

  it("asks Clerk for a fresh token on each request", async () => {
    let issued = 0;
    getToken.mockImplementation(async () => `token-${++issued}`);
    const { createUserClient } = await import("./user");
    const client = createUserClient();

    await client.from("profiles").select("clerk_user_id");
    const first = lastRequestHeaders().get("authorization");
    await client.from("profiles").select("clerk_user_id");
    const second = lastRequestHeaders().get("authorization");

    expect(first).toMatch(/^Bearer token-\d+$/);
    expect(second).toMatch(/^Bearer token-\d+$/);
    expect(second).not.toBe(first);
  });

  it("sends no user token when signed out", async () => {
    getToken.mockResolvedValue(null);
    const { createUserClient } = await import("./user");

    await createUserClient().from("profiles").select("clerk_user_id");

    expect(lastRequestHeaders().get("authorization")).not.toMatch(
      /clerk-session-token/,
    );
  });

  it("never uses the secret key", async () => {
    getToken.mockResolvedValue("clerk-session-token");
    vi.stubEnv(
      (await import("./service")).SERVICE_KEY_ENV,
      "sb_secret_should_not_appear",
    );
    const { createUserClient } = await import("./user");

    await createUserClient().from("profiles").select("clerk_user_id");

    const headers = lastRequestHeaders();
    expect(headers.get("apikey")).toBe("sb_publishable_test");
    expect([...headers.values()].join()).not.toContain("sb_secret");
  });

  it("throws a clear error without the URL", async () => {
    vi.stubEnv(URL_VAR, "");
    const { createUserClient } = await import("./user");
    expect(() => createUserClient()).toThrow(`${URL_VAR} is not set`);
  });
});

describe("createServiceClient", () => {
  beforeEach(() => {
    vi.stubEnv(URL_VAR, "https://project.supabase.co");
  });

  it("throws a clear error without its secret key", async () => {
    const { createServiceClient, SERVICE_KEY_ENV } = await import("./service");
    vi.stubEnv(SERVICE_KEY_ENV, "");
    expect(() => createServiceClient()).toThrow(
      `${SERVICE_KEY_ENV} is not set`,
    );
  });

  it("sends the secret key, not a user token", async () => {
    const { createServiceClient, SERVICE_KEY_ENV } = await import("./service");
    vi.stubEnv(SERVICE_KEY_ENV, "sb_secret_test");

    await createServiceClient().from("profiles").select("clerk_user_id");

    const headers = lastRequestHeaders();
    expect(headers.get("apikey")).toBe("sb_secret_test");
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe("loading the modules", () => {
  it("reads no environment variable until a client is created", async () => {
    vi.stubEnv(URL_VAR, "");
    vi.stubEnv(PUBLISHABLE_VAR, "");
    await expect(import("./user")).resolves.toBeDefined();
    const service = await import("./service");
    vi.stubEnv(service.SERVICE_KEY_ENV, "");
    expect(service.createServiceClient).toBeTypeOf("function");
  });
});

describe("server-only guard", () => {
  const source = (file: string) =>
    readFileSync(new URL(file, import.meta.url), "utf8");

  it.each(["./service.ts", "./user.ts", "./env.ts"])(
    "%s starts with import \"server-only\"",
    (file) => {
      expect(source(file).split("\n")[0]).toBe('import "server-only";');
    },
  );

  it("the real server-only package throws outside a server build", () => {
    const entry = source("../../node_modules/server-only/index.js");
    expect(entry).toMatch(/throw new Error/);
  });
});
