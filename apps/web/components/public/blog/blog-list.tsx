import type { Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import type { ExpertiseArea } from "@/lib/content";
import type { PostPage } from "@/lib/content/posts";
import { formatNumber } from "../home/format";
import { Pagination, SearchField } from "../listing";
import { ArticleCard, ArticleList } from "../listing/article-card";
import { MoreLink } from "../parts";
import { CategoryTabs } from "./category-tabs";
import { articlePath, BLOG_PATH, CATEGORY_PARAM, listingQuery, type BlogQuery } from "./query";

/**
 * `/blog` under its header (§6.8): the search with its result line, the area
 * tabs with their counts, the journal index (ArticleItem rows under the 2px rule) and the
 * pages. `result` holds only articles public in this language. An empty list
 * says why, in his voice, with the way back (EmptyState).
 */
export function BlogList({
  result,
  areas,
  counts,
  query,
}: {
  result: PostPage;
  /** Expertise areas published in this language: the category tabs. */
  areas: ExpertiseArea[];
  /** Articles matching the search (any area), per area slug, and in all: the tabs' counts. */
  counts: { all: number; byArea: Readonly<Record<string, number>> };
  query: BlogQuery;
}) {
  const t = useTranslations("Blog");
  const locale = useLocale() as Locale;
  // An area with nothing to show gets no tab, unless it's the chosen one.
  const tabs = areas.filter((area) => (counts.byArea[area.slug] ?? 0) > 0 || area.slug === query.category);
  const kept = listingQuery(query);
  const filtered = query.q !== null || query.category !== null;
  const allWriting = (label: string) => <MoreLink href={BLOG_PATH} label={label} />;

  return (
    <div className="flex flex-col">
      {/* The search and the tabs share a row on wide screens (the Blog mockup). */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-gutter">
        <SearchField
          pathname={BLOG_PATH}
          value={query.q ?? ""}
          query={kept}
          label={t("searchLabel")}
          clearLabel={t("clearFilters")}
          // Announces the new count after a search or a filter, zero included.
          status={
            (result.total > 0 || filtered) &&
            (query.q
              ? t("searchResults", { count: result.total, q: query.q })
              : t("resultsCount", { count: result.total }))
          }
          className="max-w-3xl lg:max-w-md lg:flex-1"
        />
        {tabs.length > 0 && (
          <CategoryTabs
            label={t("categoriesLabel")}
            pathname={BLOG_PATH}
            param={CATEGORY_PARAM}
            allCount={formatNumber(counts.all, locale)}
            options={tabs.map((area) => ({
              value: area.slug,
              label: area.title,
              count: formatNumber(counts.byArea[area.slug] ?? 0, locale),
            }))}
            query={kept}
            className="min-w-0"
          />
        )}
      </div>

      <div className="mt-8">
        {result.total === 0 ? (
          query.q ? (
            <EmptyState
              level={2}
              outline={false}
              title={t("noSearchResults.title", { q: query.q })}
              text={t("noSearchResults.text")}
              action={allWriting(t("noSearchResults.action"))}
            />
          ) : filtered ? (
            <EmptyState
              level={2}
              outline={false}
              title={t("noAreaResults.title")}
              text={t("noAreaResults.text")}
              action={allWriting(t("noAreaResults.action"))}
            />
          ) : (
            <EmptyState level={2} title={t("emptyState.title")} text={t("emptyState.text")} />
          )
        ) : (
          <ArticleList>
            {result.posts.map((post) => (
              <ArticleCard
                key={post.id}
                href={articlePath(post.slug)}
                title={post.title}
                excerpt={post.excerpt}
                category={post.expertise?.title ?? null}
                // Decorative: the title beside it names the article.
                cover={post.coverUrl ? { src: post.coverUrl, alt: "" } : null}
                publishedAt={post.publishedAt}
                readingMinutes={post.readingMinutes}
              />
            ))}
          </ArticleList>
        )}
      </div>

      <Pagination pathname={BLOG_PATH} page={result.page} totalPages={result.pageCount} query={kept} className="mt-6" />
    </div>
  );
}
