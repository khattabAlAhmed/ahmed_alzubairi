import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import type { PostDetail, PostListItem } from "@/lib/content/posts";
import { formatDate } from "../home/format";
import { NewsletterSignup } from "@/components/newsletter";
import { ArticleCard, ShareButtons } from "../listing";
import { ArticleList } from "../listing/article-card";
import { Figure } from "../listing/parts";
import { CONTAINER, ConsultationCta, MoreLink, PageSection } from "../parts";
import { ARTICLE_PROSE, RichText } from "../rich-text/rich-text";
import { articlePath, BLOG_PATH } from "./query";

/** The article's facts as a quiet ledger: when, how long, which area. */
export function ArticleLedger({ rows, className }: { rows: { label: string; value: ReactNode }[]; className?: string }) {
  const shown = rows.filter((row) => row.value);
  if (shown.length === 0) return null;
  return (
    <dl className={cx("border-t border-line", className)}>
      {shown.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
          <dt className="text-sm text-ink-2">{row.label}</dt>
          <dd className="text-base font-medium tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * `/blog/[slug]` (§6.8, ArticleBody board): under the 2px rule, the way back
 * and the ledger (date, reading time, area), the title and body at reading
 * measure with the newsletter after it, and the share column; then related
 * articles and the consultation call to action. The body is stored Tiptap JSON and goes
 * through `RichText`, never as HTML (§9).
 */
export function ArticlePage({
  post,
  related,
  shareUrl,
}: {
  post: PostDetail;
  /** Up to three articles from the same expertise area, in this language. */
  related: PostListItem[];
  /** The page's full canonical URL, or null when the site address isn't set. */
  shareUrl: string | null;
}) {
  const t = useTranslations("Blog");
  const tw = useTranslations("ContentWork.article");
  const tl = useTranslations("PublicListing");
  const locale = useLocale();

  return (
    <>
      <article className={cx(CONTAINER, "mt-8 md:mt-12")}>
        <div className="grid gap-8 border-t-2 border-rule pt-6 lg:grid-cols-12 lg:gap-gutter">
          <aside className="flex flex-col items-start gap-4 lg:col-span-3 lg:self-start">
            <MoreLink href={BLOG_PATH} label={t("allArticles")} back />
            <ArticleLedger
              className="self-stretch"
              rows={[
                {
                  label: tw("published"),
                  value: post.publishedAt && <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>,
                },
                { label: tw("reading"), value: post.readingMinutes ? tl("readingTime", { minutes: post.readingMinutes }) : null },
                { label: tw("area"), value: post.expertise?.title ?? null },
              ]}
            />
          </aside>
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-6">
            <h1 className="text-balance type-h1 settle">{post.title}</h1>
            {post.coverUrl && (
              // Decorative: the title above names the article.
              <Figure image={{ src: post.coverUrl, alt: "" }} crop="work" sizes="(min-width: 1024px) 50vw, 100vw" />
            )}
            {post.excerpt && <p className={cx(ARTICLE_PROSE, "font-medium")}>{post.excerpt}</p>}
            <RichText doc={post.body} className={ARTICLE_PROSE} />
            {/* §6.15: after the article, the newsletter. */}
            <NewsletterSignup source="blog" inline className="mt-4" />
          </div>
          {shareUrl && <ShareButtons url={shareUrl} title={post.title} className="lg:col-span-3 lg:self-start" />}
        </div>
      </article>
      <ConsultationCta />
      {related.length > 0 && (
        <div className={cx(CONTAINER, "mt-section")}>
          <PageSection id="related-articles" title={t("related")}>
            <ArticleList>
              {related.map((item) => (
                <ArticleCard
                  key={item.id}
                  href={articlePath(item.slug)}
                  title={item.title}
                  excerpt={item.excerpt}
                  category={item.expertise?.title ?? null}
                  cover={null}
                  publishedAt={item.publishedAt}
                  readingMinutes={item.readingMinutes}
                  headingLevel={3}
                />
              ))}
            </ArticleList>
          </PageSection>
        </div>
      )}
    </>
  );
}
