import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE_STRING } from "next/dist/shared/lib/router/utils/is-bot";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/**
 * User agents that get metadata (title, canonical, hreflang, Open Graph) in
 * `<head>` instead of streamed into `<body>` (§6.24). Setting this replaces
 * Next's default list, so it is that list plus Googlebot: Next leaves the main
 * Google crawler out because it runs JavaScript, but Google reads canonical
 * and hreflang only from `<head>`. "Googlebot" also covers Googlebot-Image.
 * Bing, DuckDuckGo, Yandex, Baidu, Apple and the other Google crawlers
 * (AdsBot-Google, Storebot-Google, Google-InspectionTool) are in the default.
 * Next tests it case-insensitively. Browsers keep streamed metadata.
 */
export const HTML_LIMITED_BOTS = new RegExp(`${HTML_LIMITED_BOT_UA_RE_STRING}|Googlebot`, "i");

/**
 * `next/image` may load only from the Supabase project's `public-media` bucket.
 * The host is read at build time; a build without the variable allows none.
 */
function publicMediaPattern(): URL[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return [];
  const { origin } = new URL(supabaseUrl);
  return [new URL(`${origin}/storage/v1/object/public/public-media/**`)];
}

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared", "@repo/db"],
  cacheComponents: true,
  partialPrefetching: true,
  htmlLimitedBots: HTML_LIMITED_BOTS,
  images: { remotePatterns: publicMediaPattern() },
  // API responses never belong in search results (§6.24).
  headers: async () => [{ source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }],
  // Native modules for the document watermark (§6.18). They load their own
  // platform binaries at run time, so they stay out of the bundle. `sharp` is
  // already on Next's built-in list; it is named here so the set is in one place.
  serverExternalPackages: ["@napi-rs/canvas", "sharp"],
  // The watermark font is read from disk, which tracing can't see. The open
  // route (`/api/documents/[id]/open`) and any other documents route carry it.
  outputFileTracingIncludes: {
    "/api/documents/**": ["./assets/fonts/**/*"],
  },
  // PostHog through our own origin (§6.23): ad blockers and the CSP see one
  // host. EU cloud; static bundles come from its assets host.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://eu-assets.i.posthog.com/array/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  // PostHog posts to "/ingest/e/" and "/ingest/i/v0/e/", partly with
  // keepalive/sendBeacon. Next's trailing-slash 308 runs before rewrites, and a
  // keepalive request that meets it may never finish, so events were lost (T12).
  // Next's redirect is off; proxy.ts sends page paths ending in "/" to the
  // slash-less URL itself, so "/ar/about/" still 308s to "/ar/about".
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
