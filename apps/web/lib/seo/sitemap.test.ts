import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSitemap } from "./sitemap";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example"));
afterEach(() => vi.unstubAllEnvs());

const url = (path: string) => `https://site.example${path}`;

describe("buildSitemap", () => {
  const build = () => buildSitemap({
    pages: [
      { key: "about", locales: ["ar", "en"], lastModified: "2026-11-01T00:00:00Z" },
      { key: "privacy", locales: ["ar"], lastModified: null },
    ],
    items: [
      { paths: { ar: "/services/both", en: "/services/both" }, lastModified: "2026-11-02T00:00:00Z" },
      { paths: { ar: "/blog/a" }, lastModified: null },
    ],
  });
  const entry = (path: string) => build().find((item) => item.url === url(path));

  it("lists every listing page in both languages, with alternates", () => {
    for (const path of ["", "/services", "/blog", "/contact", "/faq"]) {
      for (const locale of ["ar", "en"]) {
        expect(entry(`/${locale}${path}`)?.alternates?.languages).toEqual({
          ar: url(`/ar${path}`),
          en: url(`/en${path}`),
          "x-default": url(`/ar${path}`),
        });
      }
    }
  });

  it("lists content pages only in the languages they're published in", () => {
    expect(entry("/en/about")?.lastModified).toBe("2026-11-01T00:00:00Z");
    expect(entry("/ar/privacy")).toEqual({ url: url("/ar/privacy") });
    expect(entry("/en/privacy")).toBeUndefined();
    // Terms isn't published: it isn't listed at all.
    expect(build().some((item) => item.url.endsWith("/terms"))).toBe(false);
  });

  it("lists items per language, a single-language one with no alternates", () => {
    expect(entry("/en/services/both")).toEqual({
      url: url("/en/services/both"),
      lastModified: "2026-11-02T00:00:00Z",
      alternates: {
        languages: {
          ar: url("/ar/services/both"),
          en: url("/en/services/both"),
          "x-default": url("/ar/services/both"),
        },
      },
    });
    expect(entry("/ar/blog/a")).toEqual({ url: url("/ar/blog/a") });
    expect(entry("/en/blog/a")).toBeUndefined();
  });

  it("never lists private areas", () => {
    const urls = build().map((item) => item.url).join(" ");
    for (const part of ["/account", "/dashboard", "/sign-in", "/sign-up", "/onboarding", "/api"]) {
      expect(urls).not.toContain(part);
    }
  });
});
