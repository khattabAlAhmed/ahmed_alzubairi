import { describe, expect, it, vi } from "vitest";
import { LETTER_URL_SECONDS, openLetter, type LetterStore } from "./letter";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));

const ID = "6f9c2a7e-1b2d-4c3e-8f4a-5b6c7d8e9f01";

function deps({
  userId = "user_editor",
  allowed = true,
  path = "letters/abc.pdf" as string | null | undefined,
} = {}) {
  const store: LetterStore = {
    letterPath: vi.fn(async () => path),
    signedUrl: vi.fn(async (p: string, seconds: number) => `https://storage.test/sign/internal/${p}?expires=${seconds}`),
  };
  const createStore = vi.fn(() => store);
  return {
    store,
    createStore,
    deps: {
      permission: {
        getUserId: async () => userId,
        hasPermission: vi.fn<(key: string) => Promise<boolean>>(async () => allowed),
      },
      createStore,
    },
  };
}

describe("openLetter", () => {
  it("redirects to a 60-second signed URL, never cached", async () => {
    const { deps: d, store } = deps();
    const response = await openLetter(ID, "en", d);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://storage.test/sign/internal/letters/abc.pdf?expires=60",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(store.signedUrl).toHaveBeenCalledWith("letters/abc.pdf", LETTER_URL_SECONDS);
    expect(LETTER_URL_SECONDS).toBe(60);
  });

  it("checks content.manage, by permission key", async () => {
    const { deps: d } = deps();
    await openLetter(ID, "en", d);
    expect(d.permission.hasPermission).toHaveBeenCalledWith("content.manage");
  });

  it("lets the admin in with testimonials.approve alone", async () => {
    const { deps: d } = deps();
    vi.mocked(d.permission.hasPermission).mockImplementation(async (key: string) => key === "testimonials.approve");
    const response = await openLetter(ID, "en", d);
    expect(response.status).toBe(302);
    expect(d.permission.hasPermission).toHaveBeenCalledWith("testimonials.approve");
  });

  it("refuses a member with neither permission, before reading anything", async () => {
    const { deps: d, createStore } = deps({ allowed: false });
    const response = await openLetter(ID, "ar", d);
    expect(response.status).toBe(403);
    expect(createStore).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("forbidden");
    expect(JSON.stringify(body)).not.toContain("letters/");
  });

  it("refuses a visitor who isn't signed in", async () => {
    const { deps: d, createStore } = deps({ userId: null as unknown as string });
    const response = await openLetter(ID, "en", d);
    expect(response.status).toBe(401);
    expect(createStore).not.toHaveBeenCalled();
  });

  it("answers not found for a bad id, a missing row or a row without a letter", async () => {
    expect((await openLetter("../etc", "en", deps().deps)).status).toBe(404);
    const missing = deps();
    vi.mocked(missing.store.letterPath).mockResolvedValueOnce(undefined);
    expect((await openLetter(ID, "en", missing.deps)).status).toBe(404);
    expect((await openLetter(ID, "en", deps({ path: null }).deps)).status).toBe(404);
  });

  it("hides storage errors behind a 500", async () => {
    const { deps: d, store } = deps();
    vi.mocked(store.signedUrl).mockRejectedValueOnce(new Error("boom letters/abc.pdf"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const response = await openLetter(ID, "en", d);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("letters/");
  });
});
