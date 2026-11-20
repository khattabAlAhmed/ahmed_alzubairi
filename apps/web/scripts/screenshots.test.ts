import { resolve } from "node:path";
import type { BrowserContext, Route } from "playwright-core";
import { describe, expect, it } from "vitest";
import {
  PAGE_NAMES,
  WEB_DIR,
  boardShotName,
  findDetailPath,
  installBypass,
  parseOptions,
  previewHostFor,
  shotName,
} from "./screenshots.mjs";

describe("parseOptions", () => {
  it("defaults to localhost, every page and apps/web/screenshots", () => {
    const opts = parseOptions([], "/somewhere");
    expect(opts.baseUrl).toBe("http://localhost:3000");
    expect(opts.only).toEqual(PAGE_NAMES);
    expect(opts.out).toBe(resolve(WEB_DIR, "screenshots"));
    expect(opts.mockups).toBe(false);
    expect(opts.showConsent).toBe(false);
  });

  it("reads --base-url, --only, --out and --mockups", () => {
    const opts = parseOptions(
      ["--", "--base-url", "https://x.vercel.app/en", "--only", "home, projects", "--out", "shots", "--mockups", "--show-consent"],
      "/repo",
    );
    expect(opts.baseUrl).toBe("https://x.vercel.app");
    expect(opts.only).toEqual(["home", "projects"]);
    expect(opts.out).toBe(resolve("/repo", "shots"));
    expect(opts.mockups).toBe(true);
    expect(opts.showConsent).toBe(true);
  });

  it("refuses an unknown page", () => {
    expect(() => parseOptions(["--only", "home,nope"])).toThrow(/Unknown page\(s\): nope/);
  });
});

describe("file names", () => {
  it("follows <page>-<locale>-<width>-<theme>.png", () => {
    expect(shotName("home", "ar", 375, "dark")).toBe("home-ar-375-dark.png");
    expect(shotName("home", "ar", 375, "dark", true)).toBe("home-ar-375-dark-mockup.png");
    expect(boardShotName("Button", 1280, "light")).toBe(
      "design-system-board-Button-1280-light-mockup.png",
    );
  });
});

describe("findDetailPath", () => {
  const base = "http://localhost:3000";
  it("takes the first link one level below the section", () => {
    const hrefs = [
      "/en/projects",
      "/en/projects?sector=health",
      "https://elsewhere.com/en/projects/foreign",
      "/en/projects/-",
      "/en/projects/water-reform/",
      "/en/projects/second",
    ];
    expect(findDetailPath(hrefs, base, "en", "projects")).toBe("/en/projects/water-reform");
  });

  it("ignores other locales and returns null when nothing matches", () => {
    expect(findDetailPath(["/ar/blog/x", "/en/blog/a/b"], base, "en", "blog")).toBeNull();
  });
});

describe("previewHostFor", () => {
  it("returns the host only for an https *.vercel.app URL with a secret", () => {
    expect(previewHostFor("https://web-abc.vercel.app", "s")).toBe("web-abc.vercel.app");
    expect(previewHostFor("https://web-abc.vercel.app", undefined)).toBeNull();
    expect(previewHostFor("http://localhost:3000", "s")).toBeNull();
    expect(previewHostFor("https://vercel.app.evil.com", "s")).toBeNull();
  });
});

describe("installBypass", () => {
  type Matcher = (url: URL) => boolean;
  type Handler = (route: Route) => Promise<void>;

  function fakeContext() {
    const routes: { matcher: Matcher; handler: Handler }[] = [];
    const context = {
      route: async (matcher: Matcher, handler: Handler) => {
        routes.push({ matcher, handler });
      },
      unroute: async (matcher: Matcher) => {
        routes.splice(routes.findIndex((r) => r.matcher === matcher), 1);
      },
    } as unknown as Pick<BrowserContext, "route" | "unroute">;
    return { context, routes };
  }

  function fakeRoute(url: string) {
    let sent: Record<string, string> | undefined = undefined;
    const route = {
      request: () => ({ url: () => url, headers: () => ({ accept: "*/*" }) }),
      continue: async (o?: { headers?: Record<string, string> }) => {
        sent = o?.headers ?? { accept: "*/*" };
      },
    } as unknown as Route;
    return { route, sent: () => sent };
  }

  /** Runs a request through the context's routes the way Playwright does. */
  async function send(routes: { matcher: Matcher; handler: Handler }[], url: string) {
    const { route, sent } = fakeRoute(url);
    const hit = routes.find((r) => r.matcher(new URL(url)));
    if (hit) await hit.handler(route);
    else await route.continue();
    return sent();
  }

  it("sends the bypass headers to the preview host only", async () => {
    const { context, routes } = fakeContext();
    await installBypass(context, "web-abc.vercel.app", "secret-1");

    const preview = await send(routes, "https://web-abc.vercel.app/en/projects");
    expect(preview).toMatchObject({
      accept: "*/*",
      "x-vercel-protection-bypass": "secret-1",
      "x-vercel-set-bypass-cookie": "true",
    });

    for (const other of [
      "https://fonts.gstatic.com/a.woff2",
      "https://clerk.example.com/v1/client",
      "https://eu.i.posthog.com/e",
      "https://other-xyz.vercel.app/",
      "https://web-abc.vercel.app.evil.com/",
    ]) {
      const headers = await send(routes, other);
      expect(headers).not.toHaveProperty("x-vercel-protection-bypass");
      expect(headers).not.toHaveProperty("x-vercel-set-bypass-cookie");
    }
  });

  it("removes the route when asked", async () => {
    const { context, routes } = fakeContext();
    const remove = await installBypass(context, "web-abc.vercel.app", "s");
    expect(routes).toHaveLength(1);
    await remove();
    expect(routes).toHaveLength(0);
  });

  it("never adds headers even if called for another host", async () => {
    const { context, routes } = fakeContext();
    await installBypass(context, "web-abc.vercel.app", "s");
    const { route, sent } = fakeRoute("https://elsewhere.com/");
    await routes[0].handler(route);
    expect(sent()).toEqual({ accept: "*/*" });
  });
});
