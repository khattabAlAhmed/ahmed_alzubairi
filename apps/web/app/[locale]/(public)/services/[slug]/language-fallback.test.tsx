// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The detail pages tell the language switch where to go when their item has
// no translation (§6.1). Their own content is covered by the pages' tests.
const mocks = vi.hoisted(() => ({ availableIn: ["ar", "en"] as string[], missing: false }));
const item = () =>
  mocks.missing ? null : { id: "id-1", slug: "x", expertiseId: null, availableIn: mocks.availableIn };

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/components/language-switch", () => ({
  LanguageFallback: ({ href }: { href: string }) => <span data-testid="fallback">{href}</span>,
}));
vi.mock("@/components/public/pages", () => ({
  ServiceDetailPage: () => <h1>service</h1>,
  ExpertiseDetailPage: () => <h1>area</h1>,
}));
vi.mock("@/components/public/pages/service-projects", () => ({ getServiceProjects: async () => [] }));
vi.mock("@/components/public/projects", () => ({
  ProjectDetailPage: () => <h1>project</h1>,
  routeSlug: (slug: string) => slug,
  staticSlugs: () => [{ slug: "-" }],
}));
vi.mock("@/components/public/static-slugs", () => ({
  routeSlug: (slug: string) => slug,
  staticSlugs: () => [{ slug: "-" }],
}));
vi.mock("@/lib/content", () => ({
  getService: async () => item(),
  getExpertiseArea: async () => item(),
  getProject: async () => item(),
  getExpertiseAreas: async () => [],
  getServices: async () => [],
  getProjects: async () => [],
  getFaqs: async () => [],
}));

const routes = [
  ["services", await import("./page")],
  ["expertise", await import("../../expertise/[slug]/page")],
  ["projects", await import("../../projects/[slug]/page")],
] as const;

const params = (locale: string) => ({ params: Promise.resolve({ locale, slug: "x" }) });

afterEach(() => {
  cleanup();
  mocks.availableIn = ["ar", "en"];
  mocks.missing = false;
});

describe.each(routes)("%s detail page", (section, route) => {
  it("sends the switch to the list page when the item is English only", async () => {
    mocks.availableIn = ["en"];
    render(await route.default(params("en")));
    expect(screen.getByTestId("fallback").textContent).toBe(`/${section}`);
  });

  it("sends the switch to the list page when the item is Arabic only", async () => {
    mocks.availableIn = ["ar"];
    render(await route.default(params("ar")));
    expect(screen.getByTestId("fallback").textContent).toBe(`/${section}`);
  });

  it("keeps the normal switch when the item has both languages", async () => {
    render(await route.default(params("en")));
    expect(screen.queryByTestId("fallback")).toBeNull();
  });

  // The proxy gives a missing slug its 404 status; the page still refuses it
  // by itself, so it never depends on the proxy.
  it.each(["ar", "en"])("shows the not-found page for a missing slug in %s", async (locale) => {
    mocks.missing = true;
    await expect(route.default(params(locale))).rejects.toThrow("NOT_FOUND");
    expect(await route.generateMetadata(params(locale))).toEqual({});
  });
});
