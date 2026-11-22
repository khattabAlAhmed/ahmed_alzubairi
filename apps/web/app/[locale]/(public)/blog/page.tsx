import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewsletterSignup } from "@/components/newsletter";
import { BlogList, parseBlogQuery } from "@/components/public/blog";
import { ListSkeleton } from "@/components/feedback/list-skeletons";
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
  const [result, areas] = await Promise.all([
    getPosts(locale, { q: query.q ?? undefined, expertise: query.category ?? undefined, page: query.page }),
    getExpertiseAreas(locale),
  ]);
  return <BlogList result={result} areas={areas} query={query} />;
}

export default async function Blog({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Blog" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1 pb-section">
      <PageHero eyebrow={t("eyebrow")} title={t("heading")} intro={<p>{t("lead")}</p>} />
      <div className={`${CONTAINER} flex flex-col gap-section`}>
        <Suspense fallback={<ListSkeleton kind="articles" label={t("loading")} rows={4} />}>
          <PostsFromQuery locale={locale} searchParams={searchParams} />
        </Suspense>
        {/* §6.15: the blog is one of the three signup places. Outside the
            Suspense, so it shows while the list loads. */}
        <NewsletterSignup source="blog" inline className="max-w-2xl" />
      </div>
    </main>
  );
}
