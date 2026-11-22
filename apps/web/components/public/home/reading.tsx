import { useTranslations } from "next-intl";
import { ArticleCard, ArticleList } from "@/components/public/listing/article-card";
import { RESOURCE_ACTION, ResourceCard, ResourceList } from "@/components/public/listing/resource-card";
import { MoreLink } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import type { MediaItem, Post, Resource } from "@/lib/content";
import { FeaturedMedia } from "./media";
import { HomeSectionShell } from "./section";

/** How many of each «أتحدث وأكتب» lists (the mockup: two articles, one resource). */
export const HOME_READING = { posts: 2, resources: 1 } as const;
/** Kept for callers that read "the latest" counts. */
export const HOME_LATEST_COUNT = HOME_READING.posts;

/**
 * §6.2 #9–10 as one section, «أتحدث وأكتب» (the approved mockup): the latest
 * appearance as the featured video on the start side; on the end side the
 * latest articles as journal rows (ArticleItem) and one free resource
 * (ResourceItem). Each part shows only when it has something; the page leaves
 * the section out when all are empty. The media part follows the dashboard's
 * `media` toggle (see `composeHome`).
 */
export function ReadingSection({
  heading,
  intro,
  posts,
  resources,
  media,
}: {
  heading: string;
  intro?: string;
  posts: Post[];
  resources: Resource[];
  media: MediaItem | null;
}) {
  const t = useTranslations("Home");
  const shownPosts = posts.slice(0, HOME_READING.posts);
  const shownResources = resources.slice(0, HOME_READING.resources);
  const writing = shownPosts.length > 0 || shownResources.length > 0;

  return (
    <HomeSectionShell
      sectionKey="latest"
      heading={heading}
      intro={intro}
      band="plain"
      action={shownPosts.length > 0 ? { href: "/blog", label: t("readingMore") } : undefined}
    >
      <div className={cx("grid gap-x-gutter gap-y-10", media && writing && "lg:grid-cols-2")}>
        {media && <FeaturedMedia item={media} />}
        {writing && (
          <div className="flex min-w-0 flex-col gap-6">
            {shownPosts.length > 0 && (
              <nav aria-label={t("latestWriting")}>
                <ArticleList>
                  {shownPosts.map((post) => (
                    <ArticleCard
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      title={post.title}
                      excerpt={post.excerpt}
                      category={null}
                      cover={null}
                      publishedAt={post.publishedAt}
                      readingMinutes={post.readingMinutes}
                      headingLevel={3}
                    />
                  ))}
                </ArticleList>
              </nav>
            )}
            {shownResources.length > 0 && (
              <ResourceList>
                {shownResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    kind={resource.kind}
                    fileType={null}
                    title={resource.title}
                    description={resource.description}
                    headingLevel={3}
                    action={
                      <div className={cx(RESOURCE_ACTION, "md:self-center")}>
                        <MoreLink href="/resources" label={t("allResources")} />
                      </div>
                    }
                  />
                ))}
              </ResourceList>
            )}
          </div>
        )}
      </div>
    </HomeSectionShell>
  );
}
