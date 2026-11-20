import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contrastRatio } from "./contrast";
import { COLOR_ROLES, CONTRAST_PAIRS, roleHex } from "./tokens";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const web = join(__dirname, "..", "..", "..");

describe("design-system page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a 404 in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { default: Page } = await import("./page");
    await expect(Page({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    // The first import of the page pulls in next-intl and every section.
  }, 30_000);

  it("is noindex", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "xx" }) });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("isn't linked from any page or component", () => {
    const own = join(web, "app", "[locale]", "design-system");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (path === own || name === "node_modules" || name.startsWith(".")) continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !name.includes(".test.")) files.push(path);
      }
    };
    for (const dir of ["app", "components", "lib"]) walk(join(web, dir));
    const linking = files.filter((path) => readFileSync(path, "utf8").includes("/design-system"));
    expect(linking.map((path) => relative(web, path))).toEqual([]);
    // Reads every source file: slow when the whole suite runs at once.
  }, 30_000);
});

describe("color tokens", () => {
  it("contrastRatio matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("every text pair passes WCAG AA in both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const pair of CONTRAST_PAIRS) {
        const ratio = contrastRatio(roleHex(pair.fg, theme), roleHex(pair.bg, theme));
        expect(ratio, `${pair.fg} on ${pair.bg} (${theme})`).toBeGreaterThanOrEqual(pair.min);
      }
    }
  });

  it("matches the values in globals.css", () => {
    const css = readFileSync(join(web, "app", "globals.css"), "utf8");
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      return css.slice(start, css.indexOf("}", start));
    };
    const light = block('[data-theme="light"] {');
    const dark = block('[data-theme="dark"] {');
    for (const role of COLOR_ROLES) {
      if (role.key === "rule") continue; // rule is var(--ink) in the CSS
      expect(light, `${role.token} light`).toContain(`${role.token}: ${role.light};`);
      expect(dark, `${role.token} dark`).toContain(`${role.token}: ${role.dark};`);
    }
  });
});
