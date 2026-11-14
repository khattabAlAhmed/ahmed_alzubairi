import { beforeEach, describe, expect, it, vi } from "vitest";

const ROLE = "00000000-0000-0000-0000-000000000001";

const mocks = vi.hoisted(() => ({
  userId: "user_1" as string | null,
  profile: null as { role_id: string | null; status: string } | null,
  filters: [] as [string, string][],
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
}));

vi.mock("@/lib/supabase/user", () => ({
  createUserClient: () => ({
    from: (table: string) => {
      expect(table).toBe("profiles");
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          mocks.filters.push([column, value]);
          return query;
        },
        maybeSingle: async () => ({ data: mocks.profile, error: null }),
      };
      return query;
    },
  }),
}));

vi.mock("@/lib/supabase/service", () => {
  throw new Error("the gates must not use the service client");
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

// React's `cache` only works inside a server render; tests call through.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const { requireProfile, requireTeamMember, withQuery } = await import("./gates");

const params = (locale: string) => Promise.resolve({ locale });

beforeEach(() => {
  mocks.userId = "user_1";
  mocks.profile = null;
  mocks.filters = [];
});

describe("requireProfile", () => {
  it("sends a user with no profile to onboarding, keeping the page", async () => {
    await expect(requireProfile(params("ar"), "/account/consultations")).rejects.toThrow(
      "REDIRECT /ar/onboarding?redirect_url=%2Far%2Faccount%2Fconsultations",
    );
  });

  it("lets a user with a profile in, reading only their own row", async () => {
    mocks.profile = { role_id: null, status: "active" };
    await expect(requireProfile(params("en"), "/account")).resolves.toEqual(mocks.profile);
    expect(mocks.filters).toEqual([["clerk_user_id", "user_1"]]);
  });

  it("sends a signed-out visitor to sign-in", async () => {
    mocks.userId = null;
    await expect(requireProfile(params("en"), "/account")).rejects.toThrow(
      "REDIRECT /en/sign-in?redirect_url=%2Fen%2Faccount",
    );
  });

  it("refuses an unknown locale", async () => {
    await expect(requireProfile(params("fr"), "/account")).rejects.toThrow("NOT_FOUND");
  });

  it("fills a dynamic segment from the params", async () => {
    const route = Promise.resolve({ locale: "en", id: "a b" });
    await expect(requireProfile(route, "/account/consultations/[id]")).rejects.toThrow(
      "REDIRECT /en/onboarding?redirect_url=%2Fen%2Faccount%2Fconsultations%2Fa%2520b",
    );
  });

  it("keeps the named query keys through onboarding, and only those", async () => {
    const route = withQuery(params("ar"), Promise.resolve({ service: "strategy-review", other: "x" }), ["service"]);
    await expect(requireProfile(route, "/account/consultations/new")).rejects.toThrow(
      "REDIRECT /ar/onboarding?redirect_url=%2Far%2Faccount%2Fconsultations%2Fnew%3Fservice%3Dstrategy-review",
    );
  });

  it("keeps the query through sign-in too", async () => {
    mocks.userId = null;
    const route = withQuery(params("en"), Promise.resolve({ service: "governance" }), ["service"]);
    await expect(requireProfile(route, "/account/consultations/new")).rejects.toThrow(
      "REDIRECT /en/sign-in?redirect_url=%2Fen%2Faccount%2Fconsultations%2Fnew%3Fservice%3Dgovernance",
    );
  });

  it("drops a repeated or empty query value", async () => {
    const route = withQuery(params("en"), Promise.resolve({ service: ["a", "b"] }), ["service"]);
    await expect(requireProfile(route, "/account/consultations/new")).rejects.toThrow(
      "REDIRECT /en/onboarding?redirect_url=%2Fen%2Faccount%2Fconsultations%2Fnew",
    );
  });
});

describe("requireTeamMember", () => {
  it("lets an active profile with a role in", async () => {
    mocks.profile = { role_id: ROLE, status: "active" };
    await expect(requireTeamMember(params("ar"), "/dashboard")).resolves.toEqual(
      mocks.profile,
    );
  });

  it.each([
    ["a client", { role_id: null, status: "active" }],
    ["a disabled profile that still has a role", { role_id: ROLE, status: "disabled" }],
    ["a user with no profile", null],
  ])("sends %s to the account", async (_name, profile) => {
    mocks.profile = profile;
    await expect(requireTeamMember(params("ar"), "/dashboard")).rejects.toThrow(
      "REDIRECT /ar/account",
    );
  });
});
