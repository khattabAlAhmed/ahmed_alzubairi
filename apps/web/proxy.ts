import { clerkMiddleware } from "@clerk/nextjs/server";
import { LOCALES, type ErrorResponse, type Locale } from "@repo/shared";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import {
  decodePath,
  isApiPath,
  isPublicApiPath,
  localeFromReferer,
  protectedPageLocale,
} from "./lib/auth/paths";
import { signInPath } from "./lib/auth/return-path";
import { hasExpertiseArea, hasProject, hasService } from "./lib/content";
import ar from "./messages/ar.json";
import en from "./messages/en.json";

const handleLocale = createMiddleware(routing);
const MESSAGES = { ar, en };

/** The public detail pages: a language, a section, and exactly one slug. */
const DETAIL_PAGE = new RegExp(`^/(${LOCALES.join("|")})/(services|projects|expertise)/([^/]+)$`);
const DETAIL_CHECKS = {
  services: hasService,
  projects: hasProject,
  expertise: hasExpertiseArea,
} as const;

/**
 * No page has this path, so the catch-all answers it with the not-found page
 * and a real 404. A detail page can't set that status itself: Cache Components
 * sends its shell with a 200 before the page reads the slug. The rewrite sets
 * no status of its own: Vercel answers a 404 rewrite with its own bare 404
 * page, not the page the rewrite points to.
 */
const NOT_FOUND_PATH = "not-found";

/** The longest a request waits for the slug lookup before it passes on. */
export const DETAIL_LOOKUP_TIMEOUT_MS = 1500;

/**
 * The lookup's answer, or `true` when it takes longer than the timeout. The
 * lookup is then cancelled through its signal, so no query is left running.
 */
async function withinTimeout(lookup: (signal: AbortSignal) => Promise<boolean>): Promise<boolean> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(true);
      controller.abort();
    }, DETAIL_LOOKUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([lookup(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * False only when the lookup says this detail page isn't public in this
 * language. A failure or a slow lookup counts as "exists": the page then
 * renders as it always has and makes its own decision, so the proxy never adds
 * an error, a 404 or a long wait.
 */
async function detailPageExists(path: string): Promise<{ locale: Locale; exists: boolean } | null> {
  const match = DETAIL_PAGE.exec(path);
  if (!match) return null;
  const locale = match[1] as Locale;
  const check = DETAIL_CHECKS[match[2] as keyof typeof DETAIL_CHECKS];
  try {
    const slug = decodedSlug(match[3] as string);
    return { locale, exists: await withinTimeout((signal) => check(slug, locale, signal)) };
  } catch {
    return { locale, exists: true };
  }
}

/** The slug as the page reads it: decoded once, or as it is when it can't be. */
function decodedSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname, search } = request.nextUrl;
  // A path we can't decode can't be checked, and no real page has one.
  const path = decodePath(pathname);
  if (path === null) {
    return new NextResponse(null, { status: 400 });
  }

  if (isApiPath(path)) {
    if (!isPublicApiPath(path) && !(await auth()).isAuthenticated) {
      const locale = localeFromReferer(request.headers.get("referer"));
      const body: ErrorResponse = {
        error: {
          code: "unauthenticated",
          message: MESSAGES[locale].Errors.unauthenticated,
        },
      };
      return NextResponse.json(body, { status: 401 });
    }
    return NextResponse.next();
  }

  const locale = protectedPageLocale(path);
  if (locale && !(await auth()).isAuthenticated) {
    const target = signInPath(locale, `${pathname}${search}`);
    return NextResponse.redirect(new URL(target, request.url));
  }

  const detail = await detailPageExists(path);
  if (detail && !detail.exists) {
    return NextResponse.rewrite(new URL(`/${detail.locale}/${NOT_FOUND_PATH}`, request.url));
  }

  return handleLocale(request);
});

export const config = {
  // Every page and API route, but not Next or Vercel internals, or files.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/(.*)"],
};
