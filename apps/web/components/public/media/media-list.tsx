import { MEDIA_CATEGORIES, type Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { buttonClasses } from "@/components/ui";
import type { MediaItem } from "@/lib/content/types";
import { formatNumber } from "../home/format";
import { FilterChips, MediaCard, Pagination } from "../listing";
import { LinkIcon, PlayIcon } from "../listing/icons";
import { MediaLog } from "../listing/media-card";
import { VideoFacade } from "../listing/media-frame";
import { MoreLink } from "../parts";
import { CATEGORY_PARAM, embedUrl, listingQuery, MEDIA_PATH, mediaPage, webUrl, type MediaListQuery } from "./query";

/** A link out, in a new tab. `label` names the item for screen readers. */
function OutLink({ href, text, label, icon }: { href: string; text: string; label: string; icon: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      {icon}
      {text}
    </a>
  );
}

/**
 * `/media` under its header (§6.10): the category chips with their counts,
 * then the press log. With no category, page 1 opens with one featured video
 * whose player loads only on a click (VideoFacade); every other video is a
 * link out, so the page never loads a player by itself. `items` is every
 * public item in this language; the category and page are applied here.
 */
export function MediaList({ items, query }: { items: MediaItem[]; query: MediaListQuery }) {
  const t = useTranslations("Media");
  const listing = useTranslations("PublicListing");
  const locale = useLocale() as Locale;
  const opens = listing("opensInNewTab");
  const kept = listingQuery(query);

  if (items.length === 0) {
    return <EmptyState level={2} title={t("emptyState.title")} text={t("emptyState.text")} />;
  }

  const filtered = query.category !== null;
  const shown = filtered ? items.filter((item) => item.category === query.category) : items;
  const used = MEDIA_CATEGORIES.filter((category) => items.some((item) => item.category === category));
  const { featured, rows, page, totalPages } = mediaPage(shown, query);

  /** The links out: the video's own page (when it can't play here) and the item's link. */
  const links = (item: MediaItem, { withVideo }: { withVideo: boolean }) => {
    const video = withVideo ? webUrl(item.videoUrl) : null;
    const link = webUrl(item.url);
    if (!video && !link) return undefined;
    return (
      <>
        {video && (
          <OutLink
            href={video}
            text={t("watch")}
            label={`${t("watchLabel", { title: item.title })} ${opens}`}
            icon={<PlayIcon className="size-4" />}
          />
        )}
        {link && link !== video && (
          <OutLink
            href={link}
            text={t("open")}
            label={`${t("openLabel", { title: item.title })} ${opens}`}
            icon={<LinkIcon className="size-4" />}
          />
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3.5">
        <FilterChips
          label={t("categoriesLabel")}
          pathname={MEDIA_PATH}
          param={CATEGORY_PARAM}
          options={used.map((category) => ({
            value: category,
            label: listing(`mediaCategory.${category}`),
            count: formatNumber(items.filter((item) => item.category === category).length, locale),
          }))}
          query={kept}
        />
        {/* Announces the new count after a filter, zero included. */}
        <p role="status" className="text-ink-2 type-small">
          {t("resultsCount", { count: shown.length })}
        </p>
      </div>

      <div className="mt-7">
        {shown.length === 0 ? (
          <EmptyState
            level={2}
            outline={false}
            title={t("noResultsState.title")}
            text={t("noResultsState.text")}
            action={<MoreLink href={MEDIA_PATH} label={t("noResultsState.action")} />}
          />
        ) : (
          <div className={featured ? "grid gap-x-gutter gap-y-10 lg:grid-cols-12" : undefined}>
            {featured && (
              <MediaCard
                variant="featured"
                className="lg:col-span-5"
                category={featured.category}
                title={featured.title}
                outlet={featured.outlet}
                date={featured.date}
                image={null}
                media={
                  <VideoFacade
                    src={embedUrl(featured.videoUrl) ?? ""}
                    title={t("videoTitle", { title: featured.title })}
                    // Decorative: the title under it names the video.
                    poster={featured.imageUrl ? { src: featured.imageUrl, alt: "" } : null}
                    playLabel={t("play", { title: featured.title })}
                  />
                }
                detail={t("playerNote")}
                action={links(featured, { withVideo: false })}
              />
            )}
            {rows.length > 0 && (
              <MediaLog className={featured ? "lg:col-span-7" : undefined}>
                {rows.map((item) => (
                  <MediaCard
                    key={item.id}
                    category={item.category}
                    title={item.title}
                    outlet={item.outlet}
                    date={item.date}
                    image={null}
                    action={links(item, { withVideo: true })}
                  />
                ))}
              </MediaLog>
            )}
          </div>
        )}
      </div>
      <Pagination pathname={MEDIA_PATH} page={page} totalPages={totalPages} query={kept} className="mt-6" />
    </div>
  );
}
