import type { MediaCategory } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PlayIcon } from "@/components/icons";
import { Tag } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { formatDate, metaSeparator } from "../home/format";
import { ABOVE_LINK, CardCover, Heading, LIST_ROW, LIST_RULE, MetaLine, type ListingImage } from "./parts";

/**
 * A 16:9 frame for an embedded video. `src` must already be a safe embed URL
 * (the page builds it from an allowed host); this frame only displays it. It
 * loads lazily, and the sandbox lets the player run but not take the page.
 * `VideoFacade` (media-frame.tsx) shows the poster until a click instead.
 */
export function VideoEmbed({ src, title, className }: { src: string; title: string; className?: string }) {
  return (
    <div className={cx("relative aspect-video w-full bg-surface", className)}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        className="absolute inset-0 size-full border-0"
      />
    </div>
  );
}

type MediaCardProps = {
  category: MediaCategory;
  title: string;
  /** The outlet or organization. */
  outlet: string | null;
  date: string | null;
  image: ListingImage | null;
  /** A `VideoEmbed` or `VideoFacade`, shown in place of the image. */
  media?: ReactNode;
  action?: ReactNode;
  /** A line after the outlet: "30 minutes", "60 participants". */
  detail?: string | null;
  /** `row`: one line of the press log. `featured`: the one item shown large. */
  variant?: "row" | "featured";
  headingLevel?: 2 | 3;
  className?: string;
};

/**
 * An appearance or event (§6.10, MediaItem board). A row of the press log:
 * the date in a narrow column, the title with its kind and outlet, and the
 * category as a tag. The featured item puts the video or photo first, then the
 * record's meta line and the title. `action` holds the page's link out.
 */
export function MediaCard({
  category,
  title,
  outlet,
  date,
  image,
  media,
  action,
  detail,
  variant = "row",
  headingLevel = 2,
  className,
}: MediaCardProps) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();
  const when = date && <time dateTime={date}>{formatDate(date, locale)}</time>;
  const kind = t(`mediaCategory.${category}`);

  if (variant === "featured") {
    return (
      <article className={cx("flex flex-col gap-2.5", className)}>
        {media ?? <CardCover image={image} fallback={<PlayIcon className="size-10" />} sizes="(min-width: 768px) 45vw, 100vw" />}
        <p className="flex justify-between gap-4 border-y border-line border-t-2 border-t-rule py-2.5 text-[13px] text-ink-2 tabular-nums">
          <span>{[kind, outlet].filter(Boolean).join(metaSeparator(locale))}</span>
          {when}
        </p>
        <Heading level={headingLevel} className="type-h3">
          {title}
        </Heading>
        {detail && <p className="text-ink-2 type-small">{detail}</p>}
        {action && <div className="flex flex-wrap gap-2 pt-1">{action}</div>}
      </article>
    );
  }

  return (
    <article
      className={cx(
        LIST_ROW,
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 py-3.5 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-baseline",
        className,
      )}
    >
      <p className="col-span-2 text-[13px] text-ink-2 tabular-nums sm:col-span-1">{when}</p>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Heading level={headingLevel} className="text-[18px] leading-[1.6] font-semibold">
          {title}
        </Heading>
        <MetaLine items={[outlet, detail]} />
        {action && <div className={cx(ABOVE_LINK, "flex flex-wrap gap-2 pt-2")}>{action}</div>}
      </div>
      <Tag className="self-start sm:self-baseline">{kind}</Tag>
      {media && <div className="col-span-full pt-2 sm:col-start-2 sm:col-end-4">{media}</div>}
    </article>
  );
}

/** Press-log rows under the 2px rule. */
export function MediaLog({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(LIST_RULE, className)}>{children}</div>;
}
