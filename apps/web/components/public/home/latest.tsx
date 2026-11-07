import type { Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { ArrowForwardIcon } from "@/components/icons";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Post, Resource } from "@/lib/content";
import { formatDate } from "./format";
import { CARD, CARD_LINK, HomeSectionShell, type SectionBand } from "./section";

/** How many of each the section lists. */
export const HOME_LATEST_COUNT = 3;

const COLUMN_LINK =
  "inline-flex items-center gap-1.5 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * §6.2 #10. Each column shows only when it has items; the page leaves the
 * section out when both are empty.
 */
export function LatestSection({
  heading,
  intro,
  band,
  posts,
  resources,
  locale,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  posts: Post[];
  resources: Resource[];
  locale: Locale;
}) {
  const t = useTranslations("Home");

  return (
    <HomeSectionShell sectionKey="latest" heading={heading} intro={intro} band={band}>
      <div className="grid gap-10 lg:grid-cols-2">
        {posts.length > 0 && (
          <div>
            <h3 className="text-xl">{t("articles")}</h3>
            <ul className="mt-4 grid gap-4">
              {posts.slice(0, HOME_LATEST_COUNT).map((post) => (
                <li key={post.id} className={`${CARD} relative p-5!`}>
                  <h4 className="text-lg">
                    <Link href={`/blog/${post.slug}`} className={CARD_LINK}>
                      {post.title}
                    </Link>
                  </h4>
                  {post.excerpt && <p className="mt-2 text-pretty text-text-secondary">{post.excerpt}</p>}
                  {(post.publishedAt || post.readingMinutes) ? (
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                      {post.publishedAt && (
                        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
                      )}
                      {post.readingMinutes ? (
                        <span>{t("readingTime", { minutes: post.readingMinutes })}</span>
                      ) : null}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <Link href="/blog" className={`${COLUMN_LINK} mt-4`}>
              {t("allPosts")}
              <ArrowForwardIcon aria-hidden="true" className="size-4" />
            </Link>
          </div>
        )}
        {resources.length > 0 && (
          <div>
            <h3 className="text-xl">{t("resources")}</h3>
            <ul className="mt-4 grid gap-4">
              {resources.slice(0, HOME_LATEST_COUNT).map((resource) => (
                <li key={resource.id} className={`${CARD} p-5!`}>
                  <Badge>{t(`resourceKind.${resource.kind}`)}</Badge>
                  <h4 className="mt-2 text-lg">{resource.title}</h4>
                  {resource.description && (
                    <p className="mt-2 text-pretty text-text-secondary">{resource.description}</p>
                  )}
                </li>
              ))}
            </ul>
            <Link href="/resources" className={`${COLUMN_LINK} mt-4`}>
              {t("allResources")}
              <ArrowForwardIcon aria-hidden="true" className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </HomeSectionShell>
  );
}
