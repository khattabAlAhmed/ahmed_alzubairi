import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { FOOTER_GROUPS, FOOTER_NAV, isActivePath, MAIN_NAV, MENU_NAV } from "./nav-items";

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
  const menuAndFooter = new Set<string>([...MENU_NAV, ...FOOTER_NAV].map((item) => item.href));

  it("has the Header board's seven sections inline, and the MobileMenu board's nine in the menu", () => {
    expect(MAIN_NAV.map((item) => item.href)).toEqual(["/", "/about", "/expertise", "/services", "/projects", "/blog", "/documents"]);
    expect(MENU_NAV.map((item) => item.href)).toEqual([
      "/",
      "/about",
      "/expertise",
      "/services",
      "/projects",
      "/training",
      "/blog",
      "/documents",
      "/contact",
    ]);
  });

  it("splits the footer into the site and what he shares, as on the Footer board", () => {
    expect(FOOTER_GROUPS.map((group) => group.label)).toEqual(["footerSite", "footerKnowledge"]);
  });

  // Nothing orphaned: every public section with a page is in the menu or the footer.
  it("reaches every public section from the phone menu or the footer", () => {
    const sections = readdirSync(new URL("../app/[locale]/(public)", import.meta.url), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("[") && !entry.name.startsWith("("))
      .filter((entry) => existsSync(new URL(`../app/[locale]/(public)/${entry.name}/page.tsx`, import.meta.url)))
      .map((entry) => `/${entry.name}`)
      .filter((href) => href !== "/privacy" && href !== "/terms");
    for (const href of sections) expect(menuAndFooter.has(href), href).toBe(true);
  });

  it("lists each link once in each list, with contact last in the menu and the footer", () => {
    for (const nav of [MAIN_NAV, MENU_NAV, FOOTER_NAV]) {
      const hrefs = nav.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
    expect(MENU_NAV.at(-1)?.href).toBe("/contact");
    expect(FOOTER_NAV.at(-1)?.href).toBe("/contact");
  });

  it("has a label in both languages for every link and group", async () => {
    const [ar, en] = await Promise.all([import("../messages/ar.json"), import("../messages/en.json")]);
    const labels = [...MAIN_NAV, ...MENU_NAV, ...FOOTER_NAV].map((item) => item.label as string);
    for (const label of [...labels, ...FOOTER_GROUPS.map((group) => group.label)]) {
      expect(ar.Nav[label as keyof typeof ar.Nav], label).toBeTruthy();
      expect(en.Nav[label as keyof typeof en.Nav], label).toBeTruthy();
    }
  });

  // Each link must open a real page in the public route group (§6.1).
  const routeDir = (href: string) =>
    new URL(`../app/[locale]/(public)${href === "/" ? "" : href}/page.tsx`, import.meta.url);

  it.each([...new Set([...MAIN_NAV, ...MENU_NAV, ...FOOTER_NAV].map((item) => item.href)), "/privacy", "/terms"])(
    "%s has a page",
    (href) => {
      expect(existsSync(routeDir(href)), href).toBe(true);
    },
  );
});
