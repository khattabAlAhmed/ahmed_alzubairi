import type { Locale } from "@repo/shared";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import type { MediaItem } from "@/lib/content";
import { formatDate } from "./format";
import { CARD, HomeSectionShell, type SectionBand } from "./section";

/** §6.2 #9: the latest appearance or event. The page leaves it out when there's none. */
export function MediaSection({
  heading,
  intro,
  band,
  item,
  locale,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  item: MediaItem;
  locale: Locale;
}) {
  const t = useTranslations("Home");
  const link = item.url ?? item.videoUrl;

  return (
    <HomeSectionShell
      sectionKey="media"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/media", label: t("allMedia") }}
    >
      <article
        className={cx(
          CARD,
          "grid overflow-hidden p-0!",
          // Without an image the text takes the whole card, not the image's column.
          item.imageUrl && "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
        )}
      >
        {item.imageUrl && (
          <div className="relative aspect-[16/9] bg-text/5 md:aspect-auto">
            <Image src={item.imageUrl} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
          </div>
        )}
        <div className="p-6 md:p-8">
          <Badge>{t(`mediaCategory.${item.category}`)}</Badge>
          <h3 className="mt-3 text-2xl">{item.title}</h3>
          {(item.outlet || item.date) && (
            <p className="mt-2 text-text-secondary">
              {item.outlet}
              {item.outlet && item.date && <span aria-hidden="true"> · </span>}
              {item.date && <time dateTime={item.date}>{formatDate(item.date, locale)}</time>}
            </p>
          )}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("viewDetails")} <span className="sr-only">{t("opensInNewTab")}</span>
            </a>
          )}
        </div>
      </article>
    </HomeSectionShell>
  );
}
