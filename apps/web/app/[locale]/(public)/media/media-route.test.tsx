// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => (key: string) =>
    `${locale}:${namespace}.${key}`,
}));
vi.mock("@/components/public/parts", () => ({ CONTAINER: "", PageHero: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/ui", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/public/media", () => ({
  MediaList: () => <p>list</p>,
  parseMediaQuery: () => ({}),
}));
vi.mock("@/lib/content", () => ({ getExpertiseAreas: async () => [] }));
vi.mock("@/lib/content/media", () => ({ getMedia: async () => [], getMediaItems: async () => [] }));

const page = await import("./page");
const props = (locale: string) => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });

afterEach(cleanup);

describe("/media", () => {
  it("has a title and description per language", async () => {
    for (const locale of ["ar", "en"]) {
      const meta = await page.generateMetadata(props(locale));
      expect(meta.title).toEqual({ absolute: `${locale}:Seo.pages.media.title | Ahmed Alzubairi` });
      expect(meta.description).toBe(`${locale}:Seo.pages.media.description`);
      // A listing exists in both languages: both are alternates.
      expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(["ar", "en", "x-default"]);
    }
    expect(await page.generateMetadata(props("fr"))).toEqual({});
  });

  it("shows the page's title in its hero", async () => {
    render(await page.default(props("en")));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("en:Media.heading");
  });

  it("is not found for an unknown locale", async () => {
    await expect(page.default(props("fr"))).rejects.toThrow("NOT_FOUND");
  });
});
