// @vitest-environment jsdom
import type { TiptapDoc } from "@repo/shared";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connected: false,
  readBeforeConnection: false,
  page: null as unknown,
}));

vi.mock("next/server", () => ({
  connection: async () => {
    mocks.connected = true;
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: false }) }));
vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/components/consultation-button", () => ({
  ConsultationButton: () => <button type="button">requestConsultation</button>,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/language-switch", () => ({
  LanguageFallback: ({ href }: { href: string }) => <span data-testid="fallback">{href}</span>,
}));
vi.mock("@/lib/content", () => ({
  getPage: async () => {
    if (!mocks.connected) mocks.readBeforeConnection = true;
    return mocks.page;
  },
}));

const privacyRoute = await import("./page");
const termsRoute = await import("../terms/page");

const doc = (text: string) =>
  ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }) as TiptapDoc;
const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

beforeEach(() => {
  mocks.connected = false;
  mocks.readBeforeConnection = false;
  mocks.page = null;
});
afterEach(cleanup);

describe.each([
  ["privacy", privacyRoute],
  ["terms", termsRoute],
] as const)("%s route", (key, route) => {
  it("renders the page's title and body after waiting for a request", async () => {
    mocks.page = { key, title: `Title ${key}`, body: doc(`Body ${key}`), availableIn: ["ar", "en"] };
    render(await route.default(params("en")));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(`Title ${key}`);
    expect(screen.getByText(`Body ${key}`)).toBeTruthy();
    expect(screen.queryByTestId("fallback")).toBeNull();
    expect(mocks.readBeforeConnection).toBe(false);
  });

  it("sends the language switch home when there's no translation", async () => {
    mocks.page = { key, title: "T", body: doc("B"), availableIn: ["en"] };
    render(await route.default(params("en")));
    expect(screen.getByTestId("fallback").textContent).toBe("/");
  });

  it("returns not-found when the page isn't published in this language", async () => {
    await expect(route.default(params("ar"))).rejects.toThrow("NOT_FOUND");
  });

  it("returns not-found for an unknown locale, without reading content", async () => {
    await expect(route.default(params("fr"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.readBeforeConnection).toBe(false);
  });

  it("titles the page from its content", async () => {
    mocks.page = { key, title: `Title ${key}`, body: doc("B"), availableIn: ["ar", "en"] };
    expect(await route.generateMetadata(params("ar"))).toEqual({ title: `Title ${key}` });
  });
});
