import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BlogList, parseBlogQuery } from "@/components/public/blog";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { NewsletterSection } from "@/components/public/home/newsletter";
import { CONTAINER, PageHero } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas } from "@/lib/content";
import { getPosts } from "@/lib/content/posts";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  // Page 2 onward is its own canonical page. Search and category results are
  // views of the same posts: kept out of the index, the full list stays in it.
  const { page, q, category } = parseBlogQuery(await searchParams);
  return staticPageMetadata(locale, "blog", undefined, { page, noindex: Boolean(q || category) });
}

/**
 * The search lives in the query, which only exists at request time. The
 * posts and areas behind it are cached by tag in `lib/content`; a search is
 * free text, so the filtered list itself isn't cached.
 */
async function PostsFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const query = parseBlogQuery(await searchParams);
  const [result, matching, areas] = await Promise.all([
    getPosts(locale, { q: query.q ?? undefined, expertise: query.category ?? undefined, page: query.page }),
    // Every article matching the search, any area: the tabs' counts.
    getPosts(locale, { q: query.q ?? undefined, pageSize: Number.MAX_SAFE_INTEGER }),
    getExpertiseAreas(locale),
  ]);
  const byArea: Record<string, number> = {};
  for (const post of matching.posts) if (post.expertise) byArea[post.expertise.slug] = (byArea[post.expertise.slug] ?? 0) + 1;
  return <BlogList result={result} areas={areas} counts={{ all: matching.total, byArea }} query={query} />;
}

export default async function Blog({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, tNewsletter] = await Promise.all([
    getTranslations({ locale, namespace: "Blog" }),
    getTranslations({ locale, namespace: "Newsletter" }),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <PageHero eyebrow={t("eyebrow")} title={t("heading")} intro={<p>{t("lead")}</p>} />
      <div className={CONTAINER}>
        <Suspense fallback={<ListSkeleton kind="articles" label={t("loading")} rows={4} />}>
          <PostsFromQuery locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
      {/* §6.15: the blog is one of the three signup places, set as the home
          block (the Blog mockup). Outside the Suspense, so it shows while the
          list loads. */}
      <NewsletterSection source="blog" heading={tNewsletter("title")} intro={tNewsletter("intro")} />
    </main>
  );
}
