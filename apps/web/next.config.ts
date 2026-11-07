import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

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
  images: { remotePatterns: publicMediaPattern() },
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
