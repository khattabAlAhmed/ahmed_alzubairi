import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LanguageFallback } from "@/components/language-switch";
import { ArticlePage, articlePath, BLOG_PATH, canonicalUrl } from "@/components/public/blog";
import { routeSlug, staticSlugs } from "@/components/public/static-slugs";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { otherLocale, routing } from "@/i18n/routing";
import { getPost, getRelatedPosts } from "@/lib/content/posts";
import { docText, metaDescription, pageMetadata } from "@/lib/seo";
import { defaultShareImage } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * A placeholder only: Cache Components needs one static param, and the build
 * must never read Supabase. Real slugs render on their first request.
 */
export function generateStaticParams() {
  return staticSlugs([]);
}

const siteUrl = () => process.env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  await connection();
  const post = await getPost(routeSlug(slug), locale);
  if (!post) return {};
  // Each language has its own slug; a language without one is no alternate.
  const paths = Object.fromEntries(
    Object.entries(post.slugs).map(([language, other]) => [language, articlePath(other)]),
  );
  return pageMetadata({
    locale,
    path: paths,
    title: post.title,
    // No excerpt: the article's own opening words, not the site's description.
    description: metaDescription(post.excerpt) ?? metaDescription(docText(post.body)),
    languages: post.availableIn,
    type: "article",
    publishedTime: post.publishedAt,
    image: post.coverUrl ? { url: post.coverUrl } : await defaultShareImage(locale),
  });
}

export default async function Article({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const post = await getPost(routeSlug(slug), locale);
  if (!post) notFound();
  const related = await getRelatedPosts(post, locale);

  // Each language has its own slug, so the switch never keeps this path: it
  // goes to the translation's slug, or to the blog when there's none (§6.1).
  const translation = post.slugs[otherLocale(locale)];

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <LanguageFallback href={translation ? articlePath(translation) : BLOG_PATH} />
      <ArticlePage
        post={post}
        related={related}
        shareUrl={canonicalUrl(siteUrl(), locale, articlePath(post.slug))}
      />
    </main>
  );
}
