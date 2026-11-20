/**
 * `pnpm screenshots`: full-page screenshots of the design-system page and every
 * public page, at 375 and 1280 px, in Arabic and English, light and dark.
 * With `--mockups`, it also shoots the matching static mockups in
 * `docs/design/mockups/` so a PR can show both side by side.
 *
 * Usage: see `scripts/README.md`.
 */
import { mkdir, readdir } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { Browser, BrowserContext, Page, Route } from "playwright-core";

export const WIDTHS = [375, 1280] as const;
export const LOCALES = ["ar", "en"] as const;
export const THEMES = ["light", "dark"] as const;

export type Width = (typeof WIDTHS)[number];
export type Locale = (typeof LOCALES)[number];
export type Theme = (typeof THEMES)[number];

/** A list page whose first detail link gives a detail page its slug. */
type DetailSource = { section: string };

export type PageDef = {
  name: string;
  /** Path after `/<locale>`; empty for home. Detail pages have none. */
  path?: string;
  detailOf?: DetailSource;
  /** Mockup file name without `.html`; the English one adds `-en`. */
  mockup?: { ar: string; en: string };
};

const mock = (name: string) => ({ ar: name, en: `${name}-en` });

export const PAGES: readonly PageDef[] = [
  { name: "design-system", path: "/design-system" },
  { name: "home", path: "", mockup: { ar: "Main", en: "Home-en" } },
  { name: "about", path: "/about", mockup: mock("About") },
  { name: "expertise", path: "/expertise", mockup: mock("Expertise") },
  { name: "expertise-area", detailOf: { section: "expertise" } },
  { name: "services", path: "/services", mockup: mock("Services") },
  { name: "service", detailOf: { section: "services" }, mockup: mock("Service") },
  { name: "projects", path: "/projects", mockup: mock("Projects") },
  { name: "project", detailOf: { section: "projects" }, mockup: mock("Project") },
  { name: "clients", path: "/clients", mockup: mock("Clients") },
  { name: "documents", path: "/documents", mockup: mock("Documents") },
  { name: "training", path: "/training", mockup: mock("Training") },
  { name: "course", detailOf: { section: "training" }, mockup: mock("Course") },
  { name: "blog", path: "/blog", mockup: mock("Blog") },
  { name: "article", detailOf: { section: "blog" }, mockup: mock("Article") },
  { name: "resources", path: "/resources", mockup: mock("Resources") },
  { name: "media", path: "/media", mockup: mock("Media") },
  { name: "faq", path: "/faq", mockup: mock("FAQ") },
  { name: "contact", path: "/contact", mockup: mock("Contact") },
  { name: "privacy", path: "/privacy", mockup: mock("Legal") },
  { name: "terms", path: "/terms", mockup: mock("Legal") },
  { name: "not-found", path: "/screenshots-no-such-page", mockup: mock("NotFound") },
  { name: "sign-in", path: "/sign-in", mockup: mock("SignIn") },
  { name: "sign-up", path: "/sign-up", mockup: mock("SignUp") },
];

export const PAGE_NAMES = PAGES.map((p) => p.name);

export type Options = {
  baseUrl: string;
  only: string[];
  out: string;
  mockups: boolean;
  showConsent: boolean;
  help: boolean;
};

const here = dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = resolve(here, "..");
export const REPO_DIR = resolve(WEB_DIR, "../..");
export const MOCKUPS_DIR = resolve(REPO_DIR, "docs/design/mockups");

/**
 * Parses the CLI. A relative `--out` is read against the directory the user
 * ran `pnpm` in (`INIT_CWD`), not `apps/web`.
 */
export function parseOptions(
  argv: string[],
  cwd: string = process.env.INIT_CWD ?? process.cwd(),
): Options {
  const { values } = parseArgs({
    args: argv.filter((a) => a !== "--"),
    options: {
      "base-url": { type: "string", default: "http://localhost:3000" },
      only: { type: "string" },
      out: { type: "string" },
      mockups: { type: "boolean", default: false },
      "show-consent": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  const baseUrl = new URL(values["base-url"]).origin;
  const only = values.only
    ? values.only.split(",").map((s) => s.trim()).filter(Boolean)
    : [...PAGE_NAMES];
  const unknown = only.filter((n) => !PAGE_NAMES.includes(n));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown page(s): ${unknown.join(", ")}. Pages: ${PAGE_NAMES.join(", ")}`,
    );
  }
  const out = values.out
    ? isAbsolute(values.out)
      ? values.out
      : resolve(cwd, values.out)
    : resolve(WEB_DIR, "screenshots");

  return {
    baseUrl,
    only,
    out,
    mockups: values.mockups,
    showConsent: values["show-consent"],
    help: values.help,
  };
}

export function shotName(
  page: string,
  locale: Locale,
  width: Width,
  theme: Theme,
  mockup = false,
): string {
  return `${page}-${locale}-${width}-${theme}${mockup ? "-mockup" : ""}.png`;
}

export function boardShotName(board: string, width: Width, theme: Theme): string {
  return `design-system-board-${board}-${width}-${theme}-mockup.png`;
}

/**
 * The first link on a list page that points one level below its section,
 * e.g. `/en/projects/some-slug`. Links to other hosts don't count.
 */
export function findDetailPath(
  hrefs: string[],
  baseUrl: string,
  locale: Locale,
  section: string,
): string | null {
  const origin = new URL(baseUrl).origin;
  const pattern = new RegExp(`^/${locale}/${section}/([^/]+)/?$`);
  for (const href of hrefs) {
    let url: URL;
    try {
      url = new URL(href, origin);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    const match = pattern.exec(url.pathname);
    if (match && match[1] !== "-") return url.pathname.replace(/\/$/, "");
  }
  return null;
}

/** The preview host to send the bypass to, or null when there is none. */
export function previewHostFor(
  baseUrl: string,
  secret: string | undefined,
): string | null {
  if (!secret) return null;
  const { protocol, host, hostname } = new URL(baseUrl);
  if (protocol !== "https:" || !hostname.endsWith(".vercel.app")) return null;
  return host;
}

type RouteContext = Pick<BrowserContext, "route" | "unroute">;

/**
 * Adds the Vercel bypass headers to requests for `host` only. It's a route on
 * that host, never `extraHTTPHeaders`, so the secret never reaches another
 * host (fonts, Clerk, PostHog). Returns a function that removes the route.
 */
export async function installBypass(
  context: RouteContext,
  host: string,
  secret: string,
): Promise<() => Promise<void>> {
  const matches = (url: URL) => url.host === host;
  const handler = async (route: Route) => {
    const request = route.request();
    if (new URL(request.url()).host !== host) return route.continue();
    return route.continue({
      headers: {
        ...request.headers(),
        "x-vercel-protection-bypass": secret,
        "x-vercel-set-bypass-cookie": "true",
      },
    });
  };
  await context.route(matches, handler);
  return () => context.unroute(matches, handler);
}

/**
 * Opens `/robots.txt` once per context. It proves the app is reachable (so a
 * stopped `pnpm dev` fails fast with a clear message) and, on a preview, gets
 * the bypass cookie. The bypass route is removed right after: a route that
 * rewrites headers keeps PostHog's `/ingest` posts from finishing.
 */
async function warmUp(context: BrowserContext, opts: Options) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const host = previewHostFor(opts.baseUrl, secret);
  const remove = host && secret ? await installBypass(context, host, secret) : null;
  const page = await context.newPage();
  try {
    const res = await page.goto(`${opts.baseUrl}/robots.txt`);
    const landed = new URL(page.url()).origin;
    const status = res?.status() ?? 0;
    // A protected preview without the bypass redirects to vercel.com/login.
    if (landed !== opts.baseUrl || status === 401 || status === 403) {
      throw new Error(
        `${opts.baseUrl} answered ${status} at ${landed}. For a preview, set VERCEL_AUTOMATION_BYPASS_SECRET.`,
      );
    }
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("net::")) {
      throw new Error(
        `Can't reach ${opts.baseUrl} (${message.split("\n")[0]}). Start the app with \`pnpm dev\`, or pass --base-url.`,
      );
    }
    throw error;
  } finally {
    await page.close();
    await remove?.();
  }
}

// A plain Chrome user agent: Arcjet treats "HeadlessChrome" as a bot.
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const VIEWPORT_HEIGHT: Record<Width, number> = { 375: 812, 1280: 800 };

async function newContext(
  browser: Browser,
  width: Width,
  theme: Theme,
  showConsent: boolean,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT[width] },
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: "reduce",
    userAgent: USER_AGENT,
  });
  context.setDefaultNavigationTimeout(90_000);
  context.setDefaultTimeout(30_000);
  // The app's theme switch is next-themes, which stores the choice in
  // localStorage["theme"]. Set it before any page script runs.
  // Unless --show-consent, the cookie choice is "denied": the fixed banner
  // would cover the page in full-page shots, and PostHog stays off.
  await context.addInitScript(({ value, consent }) => {
    try {
      window.localStorage.setItem("theme", value);
      if (consent) window.localStorage.setItem("consent", "denied");
    } catch {
      // Storage blocked: the colorScheme above still picks the theme.
    }
  }, { value: theme, consent: !showConsent });
  return context;
}

/** Waits for fonts, loads lazy images by scrolling, and settles. */
async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => {});
  // `next dev` adds a fixed issues badge; it isn't part of the page.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((r) => {
              img.addEventListener("load", r, { once: true });
              img.addEventListener("error", r, { once: true });
              setTimeout(r, 5_000);
            }),
        ),
    );
    await document.fonts.ready;
  });
  await page.waitForTimeout(300);
}

type Look = { dir: string; dark: boolean };

async function look(page: Page): Promise<Look> {
  return page.evaluate(() => ({
    dir: document.documentElement.dir,
    dark: document.documentElement.classList.contains("dark"),
  }));
}

async function discoverDetailPaths(
  context: BrowserContext,
  opts: Options,
  wanted: PageDef[],
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const page = await context.newPage();
  try {
    for (const def of wanted) {
      if (!def.detailOf) continue;
      for (const locale of LOCALES) {
        const listUrl = `${opts.baseUrl}/${locale}/${def.detailOf.section}`;
        await page.goto(listUrl, { waitUntil: "load" });
        const hrefs = await page.$$eval("a[href]", (as) =>
          as.map((a) => a.getAttribute("href") ?? ""),
        );
        const path = findDetailPath(hrefs, opts.baseUrl, locale, def.detailOf.section);
        if (path) found.set(`${def.name}:${locale}`, path);
        else console.warn(`warn  no ${def.name} link on ${listUrl}; skipped`);
      }
    }
  } finally {
    await page.close();
  }
  return found;
}

async function listBoards(): Promise<string[]> {
  const files = await readdir(resolve(MOCKUPS_DIR, "components"));
  return files
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.slice(0, -".html".length))
    .sort();
}

async function main() {
  const opts = parseOptions(process.argv.slice(2));
  if (opts.help) {
    console.log(
      `pnpm screenshots [--base-url URL] [--only page,...] [--out DIR] [--mockups] [--show-consent]\nPages: ${PAGE_NAMES.join(", ")}`,
    );
    return;
  }
  const { chromium } = await import("playwright-core");
  await mkdir(opts.out, { recursive: true });
  const wanted = PAGES.filter((p) => opts.only.includes(p.name));
  const bypassHost = previewHostFor(
    opts.baseUrl,
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  );
  console.log(
    `Shooting ${wanted.length} page(s) from ${opts.baseUrl} into ${opts.out}` +
      (bypassHost ? ` (bypass for ${bypassHost})` : ""),
  );

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const failures: string[] = [];
  let count = 0;
  try {
    let detailPaths = new Map<string, string>();
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        const context = await newContext(browser, width, theme, opts.showConsent);
        try {
          await warmUp(context, opts);
          if (detailPaths.size === 0 && wanted.some((p) => p.detailOf)) {
            detailPaths = await discoverDetailPaths(context, opts, wanted);
          }
          const page = await context.newPage();
          for (const locale of LOCALES) {
            for (const def of wanted) {
              const path = def.detailOf
                ? detailPaths.get(`${def.name}:${locale}`)
                : `/${locale}${def.path ?? ""}`;
              if (path === undefined) continue;
              const file = shotName(def.name, locale, width, theme);
              try {
                const res = await page.goto(`${opts.baseUrl}${path}`);
                await settle(page);
                const status = res?.status() ?? 0;
                const seen = await look(page);
                await page.screenshot({ path: resolve(opts.out, file), fullPage: true });
                count++;
                const landed = new URL(page.url()).origin;
                const notes = [
                  landed !== opts.baseUrl ? `left the site for ${landed}` : "",
                  status !== 200 && def.name !== "not-found" ? `status ${status}` : "",
                  seen.dark !== (theme === "dark") ? "theme NOT applied" : "",
                  seen.dir !== (locale === "ar" ? "rtl" : "ltr") ? `dir=${seen.dir}` : "",
                ].filter(Boolean);
                console.log(`${notes.length ? "warn " : "ok   "} ${file} ${path} ${notes.join("; ")}`);
              } catch (error) {
                failures.push(file);
                console.error(`FAIL  ${file} ${path}: ${(error as Error).message}`);
              }
            }
          }
          await page.close();

          if (opts.mockups) {
            count += await shootMockups(context, wanted, width, theme, opts, failures);
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    // Bounded: a crashed browser can make close() wait forever.
    await Promise.race([
      browser.close(),
      // unref: a prompt close() doesn't wait for this timer.
      new Promise((r) => setTimeout(r, 10_000).unref()),
    ]);
  }
  console.log(`\n${count} screenshot(s) in ${opts.out}; ${failures.length} failed`);
  if (failures.length > 0) process.exitCode = 1;
}

async function shootMockups(
  context: BrowserContext,
  wanted: PageDef[],
  width: Width,
  theme: Theme,
  opts: Options,
  failures: string[],
): Promise<number> {
  let count = 0;
  const page = await context.newPage();
  const shoot = async (file: string, htmlPath: string) => {
    const url = pathToFileURL(htmlPath);
    if (theme === "dark") url.search = "?theme=dark";
    try {
      await page.goto(url.href);
      await settle(page);
      await page.screenshot({ path: resolve(opts.out, file), fullPage: true });
      count++;
      console.log(`ok    ${file}`);
    } catch (error) {
      failures.push(file);
      console.error(`FAIL  ${file}: ${(error as Error).message}`);
    }
  };
  for (const def of wanted) {
    if (!def.mockup) continue;
    for (const locale of LOCALES) {
      const html = resolve(MOCKUPS_DIR, "pages", `${def.mockup[locale]}.html`);
      await shoot(shotName(def.name, locale, width, theme, true), html);
    }
  }
  if (wanted.some((p) => p.name === "design-system")) {
    for (const board of await listBoards()) {
      const html = resolve(MOCKUPS_DIR, "components", `${board}.html`);
      await shoot(boardShotName(board, width, theme), html);
    }
  }
  await page.close();
  return count;
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
