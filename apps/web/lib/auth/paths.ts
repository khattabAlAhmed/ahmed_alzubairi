import { LOCALES, type Locale } from "@repo/shared";

const PROTECTED_PAGE = new RegExp(
  `^/(${LOCALES.join("|")})/(account|dashboard|onboarding)(/|$)`,
);

// Every other API route needs a session, so a new route is protected unless it
// is added here on purpose. These are the public and system routes in §8; the
// system routes check a signature or secret of their own.
const PUBLIC_API = [
  /^\/api\/contact$/,
  /^\/api\/newsletter\/(subscribe|confirm)$/,
  /^\/api\/resources\/[^/]+\/download$/,
  /^\/api\/training\/custom-requests$/,
  /^\/api\/clerk\/webhook$/,
  /^\/api\/resend\/webhook$/,
  /^\/api\/cron\/hourly$/,
  /^\/api\/posthog-config$/,
];

/** Next decodes a path to match a route, so checks must see it decoded too. */
export function decodePath(pathname: string) {
  try {
    return decodeURI(pathname);
  } catch {
    return null;
  }
}

export function protectedPageLocale(pathname: string): Locale | null {
  const match = PROTECTED_PAGE.exec(pathname);
  return match ? (match[1] as Locale) : null;
}

export function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isPublicApiPath(pathname: string) {
  return PUBLIC_API.some((route) => route.test(pathname));
}

/** API requests come from our pages, so the referrer's path gives the language. */
export function localeFromReferer(referer: string | null): Locale {
  const segment = referer?.match(/^https?:\/\/[^/]+\/([^/?#]+)/)?.[1];
  return LOCALES.find((locale) => locale === segment) ?? "ar";
}
