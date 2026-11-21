import type { Locale } from "@repo/shared";
import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "@/components/icons";
import type { MediaItem } from "@/lib/content";
import { MediaCard } from "../listing/media-card";
import { VideoFacade } from "../listing/media-frame";
import { embedUrl, webUrl } from "../media/query";
import { HomeSectionShell, type SectionBand } from "./section";

/**
 * §6.2 #9: the latest appearance or event, as the press log's featured item
 * (MediaItem board). A YouTube or Vimeo video shows its poster and loads the
 * player only on a click. The page leaves the section out when there's none.
 */
export function MediaSection({
  heading,
  intro,
  band,
  item,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  item: MediaItem;
  /** Kept for the caller; the date reads the page's language. */
  locale?: Locale;
}) {
  const t = useTranslations("Home");
  const tw = useTranslations("ContentWork.media");
  const link = webUrl(item.url) ?? webUrl(item.videoUrl);
  const embed = embedUrl(item.videoUrl);
  const poster = item.imageUrl ? { src: item.imageUrl, alt: "" } : null;

  return (
    <HomeSectionShell
      sectionKey="media"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/media", label: t("allMedia") }}
    >
      <MediaCard
        variant="featured"
        headingLevel={3}
        className="md:max-w-[42rem]"
        category={item.category}
        title={item.title}
        outlet={item.outlet}
        date={item.date}
        image={poster}
        media={
          embed ? (
            <VideoFacade
              src={embed}
              title={tw("videoTitle", { title: item.title })}
              poster={poster}
              playLabel={tw("play")}
              fallback={link ? { href: link, label: `${tw("watchOnSite")} ${t("opensInNewTab")}` } : undefined}
            />
          ) : undefined
        }
        action={
          link && !embed ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[15px] text-accent underline decoration-1 underline-offset-5 transition-state hover:decoration-2 focus-ring"
            >
              {t("viewDetails")}
              <ExternalLinkIcon aria-hidden="true" className="dir-icon size-3.5" />
              <span className="sr-only">{t("opensInNewTab")}</span>
            </a>
          ) : undefined
        }
      />
    </HomeSectionShell>
  );
}
