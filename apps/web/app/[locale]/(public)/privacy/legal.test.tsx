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
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale }: { locale: string }) => (key: string) => `${locale}:${key}`,
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
  Link: ({ children, ...props }: { href: string; children: ReactNode }) => <a {...props}>{children}</a>,
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
    mocks.page = { key, title: `Title ${key}`, body: doc(`Body ${key}`), updatedAt: "2026-03-04T10:00:00Z", availableIn: ["ar", "en"] };
    render(await route.default(params("en")));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(`Title ${key}`);
    expect(screen.getByText(`Body ${key}`)).toBeTruthy();
    expect(screen.queryByTestId("fallback")).toBeNull();
    expect(mocks.readBeforeConnection).toBe(false);
  });

  it("lists both legal pages beside the text and marks this one", async () => {
    mocks.page = { key, title: "T", body: doc("B"), updatedAt: "2026-03-04T10:00:00Z", availableIn: ["ar", "en"] };
    render(await route.default(params("en")));
    const index = screen.getByRole("navigation", { name: "en:indexLabel" });
    const links = Array.from(index.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/privacy", "/terms"]);
    expect(links.map((link) => link.textContent)).toEqual(["en:privacy", "en:terms"]);
    const current = links.filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.getAttribute("href"))).toEqual([`/${key}`]);
  });

  it("shows when the text last changed, as a month in the reader's language", async () => {
    mocks.page = { key, title: "T", body: doc("B"), updatedAt: "2026-03-04T10:00:00Z", availableIn: ["ar", "en"] };
    render(await route.default(params("ar")));
    const time = screen.getByText("مارس ٢٠٢٦");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("datetime")).toBe("2026-03-04T10:00:00Z");
    expect(screen.getByText("ar:lastUpdated")).toBeTruthy();
  });

  it("lists the text's parts and links each to its heading", async () => {
    const heading = (value: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: value }] });
    const body = { type: "doc", content: [heading("Collect"), heading("Rights")] } as TiptapDoc;
    mocks.page = { key, title: "T", body, updatedAt: "2026-03-04T10:00:00Z", availableIn: ["ar", "en"] };
    render(await route.default(params("en")));
    const contents = screen.getByRole("navigation", { name: "en:contentsLabel" });
    const links = Array.from(contents.querySelectorAll("a"));
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Collect", "#part-1"],
      ["Rights", "#part-2"],
    ]);
    expect(document.getElementById("part-2")?.textContent).toBe("Rights");
  });

  it("leaves out the contents list for a text with one part or none", async () => {
    mocks.page = { key, title: "T", body: doc("B"), updatedAt: "2026-03-04T10:00:00Z", availableIn: ["ar", "en"] };
    render(await route.default(params("en")));
    expect(screen.queryByRole("navigation", { name: "en:contentsLabel" })).toBeNull();
  });

  it("sends the language switch home when there's no translation", async () => {
    mocks.page = { key, title: "T", body: doc("B"), updatedAt: "2026-03-04T10:00:00Z", availableIn: ["en"] };
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
    mocks.page = { key, title: `Title ${key}`, body: doc("B"), updatedAt: "2026-03-04T10:00:00Z", availableIn: ["ar"] };
    const meta = await route.generateMetadata(params("ar"));
    expect(meta.title).toEqual({ absolute: `ar:pages.${key}.title | Ahmed Alzubairi` });
    expect(meta.description).toBe(`ar:pages.${key}.description`);
    // Published in Arabic only: no English alternate.
    expect(meta.alternates?.languages).toBeUndefined();
    expect(meta.robots).toBeUndefined();
  });
});
