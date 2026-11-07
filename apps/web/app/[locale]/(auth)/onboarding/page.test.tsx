import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "user_1" as string | null,
  hasProfile: true,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
  currentUser: async () => ({ fullName: "Test Person" }),
}));
vi.mock("@/lib/auth/gates", () => ({
  readOwnProfile: async () =>
    mocks.hasProfile ? { role_id: null, status: "active" } : null,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getMessages: async () => ({ Onboarding: {}, Errors: {} }),
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const { default: OnboardingPage } = await import("./page");

function open(locale: string, redirectUrl?: string | string[]) {
  return OnboardingPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(
      redirectUrl === undefined ? {} : { redirect_url: redirectUrl },
    ),
  });
}

beforeEach(() => {
  mocks.userId = "user_1";
  mocks.hasProfile = true;
});

describe("onboarding page", () => {
  it("sends a user who already has a profile to the return path", async () => {
    await expect(open("ar", "/ar/account/consultations")).rejects.toThrow(
      "REDIRECT /ar/account/consultations",
    );
  });

  it.each([
    "https://evil.example/x",
    "//evil.example/x",
    "/\\evil.example",
    "/ar/sign-in",
  ])("ignores the unsafe return path %s and uses the account", async (unsafe) => {
    await expect(open("ar", unsafe)).rejects.toThrow(/^REDIRECT \/ar\/account$/);
  });

  it("ignores a repeated return parameter", async () => {
    await expect(open("en", ["/en/account/documents", "/x"])).rejects.toThrow(
      /^REDIRECT \/en\/account$/,
    );
  });

  it("shows the form, carrying a safe return path, when there is no profile", async () => {
    mocks.hasProfile = false;
    const page = await open("ar", "/ar/account/consultations");
    expect(JSON.stringify(page)).toContain('"destination":"/ar/account/consultations"');
  });

  it("sends a signed-out visitor to sign-in, then back here", async () => {
    mocks.userId = null;
    await expect(open("en", "/en/account")).rejects.toThrow(
      "REDIRECT /en/sign-in?redirect_url=%2Fen%2Fonboarding%3Fredirect_url%3D%252Fen%252Faccount",
    );
  });
});
