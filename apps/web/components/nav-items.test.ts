import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { FOOTER_NAV, isActivePath, MAIN_NAV } from "./nav-items";

describe("isActivePath", () => {
  it("matches home only on the exact path", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/about", "/")).toBe(false);
  });

  it("matches a section and its sub-pages", () => {
    expect(isActivePath("/blog", "/blog")).toBe(true);
    expect(isActivePath("/blog/post", "/blog")).toBe(true);
  });

  it("doesn't match a path that only shares the prefix", () => {
    expect(isActivePath("/blogger", "/blog")).toBe(false);
  });
});

describe("nav links", () => {
  // Each link must open a real page in the public route group (§6.1).
  const routeDir = (href: string) =>
    new URL(`../app/[locale]/(public)${href === "/" ? "" : href}/page.tsx`, import.meta.url);

  it.each([...new Set([...MAIN_NAV, ...FOOTER_NAV].map((item) => item.href)), "/privacy", "/terms"])(
    "%s has a page",
    (href) => {
      expect(existsSync(routeDir(href)), href).toBe(true);
    },
  );
});
