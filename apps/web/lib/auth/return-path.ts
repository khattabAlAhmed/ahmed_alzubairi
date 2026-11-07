// Clerk's own parameter name, because Clerk keeps it across its steps, such as
// email verification. It would drop any other name. Clerk never acts on it here:
// the forms pass `forceRedirectUrl`, built from what `safeReturnPath` allows.
export const RETURN_PARAM = "redirect_url";

// Any real origin works: it only lets `URL` show where a value would land.
const SITE = "https://site.invalid";

// Sending someone back to these would loop.
const AUTH_PAGE = /^\/[^/]+\/sign-(in|up)(\/|$)/;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Returns a same-site path and query, or null for anything else. The value
 * comes from the URL, so an attacker can put anything in it.
 */
export function safeReturnPath(value: string | null | undefined) {
  if (!value?.startsWith("/")) {
    return null;
  }

  const decoded = safeDecode(value);
  if (decoded === null || decoded.startsWith("//") || decoded.includes("\\")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value, SITE);
  } catch {
    return null;
  }

  if (url.origin !== SITE || AUTH_PAGE.test(url.pathname)) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function withReturnPath(path: string, returnPath: string | null) {
  return returnPath
    ? `${path}?${RETURN_PARAM}=${encodeURIComponent(returnPath)}`
    : path;
}

export function signInPath(locale: string, returnPath: string | null = null) {
  return withReturnPath(`/${locale}/sign-in`, returnPath);
}

export function signUpPath(locale: string, returnPath: string | null = null) {
  return withReturnPath(`/${locale}/sign-up`, returnPath);
}

export function onboardingPath(
  locale: string,
  returnPath: string | null = null,
) {
  return withReturnPath(`/${locale}/onboarding`, returnPath);
}
