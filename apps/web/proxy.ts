import { clerkMiddleware } from "@clerk/nextjs/server";
import type { ErrorResponse } from "@repo/shared";
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
import ar from "./messages/ar.json";
import en from "./messages/en.json";

const handleLocale = createMiddleware(routing);
const MESSAGES = { ar, en };

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

  return handleLocale(request);
});

export const config = {
  // Every page and API route, but not Next or Vercel internals, or files.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/(.*)"],
};
