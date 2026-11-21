import type { MetadataRoute } from "next";

/**
 * Never crawled: the API only. Pages that must stay out of search (account,
 * dashboard, sign-in/up, onboarding, design-system) carry `noindex` instead: a
 * disallow would stop crawlers from reading it, and a linked URL could still
 * be listed.
 */
export const DISALLOWED_PATHS = ["/api/"] as const;

/**
 * `robots.txt`: only production is crawled. Previews, staged builds without
 * the variable, and local dev disallow everything.
 */
export function robotsFor(vercelEnv: string | undefined, origin: URL): MetadataRoute.Robots {
  if (vercelEnv !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] },
    sitemap: new URL("/sitemap.xml", origin).toString(),
  };
}
