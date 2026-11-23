import Image from "next/image";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { metaSeparator } from "../home/format";

/*
 * Shared parts of the work and reading lists (the MediaFrame board and the
 * record's rows). Lists are rows on hairlines under a 2px rule, never a grid
 * of identical cards (DESIGN.md "Banned patterns").
 */

/** A row's title link. Its ::after covers the row, so the row is one target. */
export const TITLE_LINK =
  "no-underline after:absolute after:inset-0 hover:underline hover:decoration-1 hover:underline-offset-7 focus-ring";

/** Actions inside a row sit above the title link's overlay. */
export const ABOVE_LINK = "relative z-10";

/** The 2px rule that opens a list of rows. */
export const LIST_RULE = "border-t-2 border-rule";

/** One row of a list: a hairline under it. */
export const LIST_ROW = "relative border-b border-line";

export type ListingImage = { src: string; alt: string };

/** The photo crops (DESIGN.md "Imagery"). */
export const PHOTO_CROPS = {
  /** 4:5, for Ahmed. */
  portrait: "aspect-[4/5]",
  /** 3:2, for work: the field, workshops, meetings. */
  work: "aspect-[3/2]",
  /** 1:1, for a detail. */
  detail: "aspect-square",
  /** 16:9, for quiet backgrounds, and listing cards. */
  wide: "aspect-video",
  /** 21:8, the wide band under an expertise area's header. */
  band: "aspect-[21/8]",
} as const;

export type PhotoCrop = keyof typeof PHOTO_CROPS;

/**
 * The hatched panel a missing photo shows (`.r-photo-missing`), never a broken
 * image. `label` says so in words; without it the panel is decorative.
 */
export function PhotoMissing({
  label,
  icon,
  crop,
  className,
}: {
  label?: string;
  icon?: ReactNode;
  crop?: PhotoCrop;
  className?: string;
}) {
  return (
    <div
      aria-hidden={label ? undefined : "true"}
      className={cx(
        "flex flex-col items-center justify-center gap-1.5 border border-line p-4 text-center text-[13px] text-ink-2",
        "bg-[repeating-linear-gradient(135deg,var(--surface)_0_10px,var(--bg)_10px_20px)]",
        crop ? PHOTO_CROPS[crop] : "h-full",
        className,
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label && <span>{label}</span>}
    </div>
  );
}

/**
 * A card's picture, lazy and sized for a three-column grid: square corners,
 * true colors, no frame or shadow. Without one, the hatched missing-photo
 * panel keeps the grid even and never shows a broken image. `missingLabel`
 * says so in words (from messages); without it the panel is decorative, since the card's title already names the item.
 */
export function CardCover({
  image,
  fallback,
  crop = "wide",
  missingLabel,
  sizes = "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw",
}: {
  image: ListingImage | null;
  /** The icon inside the missing-photo panel. */
  fallback: ReactNode;
  crop?: PhotoCrop;
  missingLabel?: string;
  sizes?: string;
}) {
  return (
    <div className={cx("relative shrink-0 bg-surface", PHOTO_CROPS[crop])}>
      {image ? (
        <Image src={image.src} alt={image.alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div
          aria-hidden={missingLabel ? undefined : "true"}
          className={cx(
            "flex h-full flex-col items-center justify-center gap-1.5 border border-line p-4 text-center text-ink-2 type-caption",
            "bg-[repeating-linear-gradient(135deg,var(--surface)_0_10px,var(--bg)_10px_20px)]",
          )}
        >
          <span aria-hidden="true">{fallback}</span>
          {missingLabel && <span>{missingLabel}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Room for the Quick contact tab (`quick-contact.tsx`), which rests fixed at
 * the bottom start corner, 16px in: 44px wide on phones, up to 154px with its
 * label from `sm` ("Quick contact"), plus an 8px gap. Measured from the page
 * column, which starts `--page-margin` in.
 */
const QUICK_CONTACT_ROOM = "ps-[calc(68px-var(--page-margin))] sm:ps-[calc(178px-var(--page-margin))]";

/**
 * Image with caption (MediaFrame board): the photo at its crop, then a caption
 * line in `ink-2`, with an optional note at the end ("Placeholder photo").
 * `clearQuickContact` is for a full-width photo whose caption can land in the
 * first screen where the Quick contact tab rests (the expertise band): the
 * caption moves to the end edge, and long text wraps before reaching the tab.
 */
export function Figure({
  image,
  crop = "work",
  caption,
  note,
  missingLabel,
  sizes = "(min-width: 768px) 50vw, 100vw",
  priority = false,
  clearQuickContact = false,
  className,
}: {
  image: ListingImage | null;
  crop?: PhotoCrop;
  caption?: ReactNode;
  note?: ReactNode;
  missingLabel?: string;
  sizes?: string;
  /** Load at once, at high priority: only for a photo that can be the page's LCP (in the first screen). */
  priority?: boolean;
  clearQuickContact?: boolean;
  className?: string;
}) {
  return (
    <figure className={className}>
      {image ? (
        <div className={cx("relative bg-surface", PHOTO_CROPS[crop])}>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={sizes}
            loading={priority ? "eager" : undefined}
            fetchPriority={priority ? "high" : undefined}
            className="object-cover"
          />
        </div>
      ) : (
        <PhotoMissing crop={crop} label={missingLabel} />
      )}
      {(caption || note) && (
        <figcaption
          className={cx(
            "flex gap-3 pt-2 text-[13px] text-ink-2",
            clearQuickContact ? cx("justify-end text-end", QUICK_CONTACT_ROOM) : "justify-between",
          )}
        >
          <span>{caption}</span>
          {note && <span>{note}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/** Short facts on one line, split by a dot (an em dash on Arabic pages), wrapping on phones. */
export function MetaLine({ items: all, className }: { items: ReactNode[]; className?: string }) {
  const locale = useLocale();
  const items = all.filter(Boolean);
  if (items.length === 0) return null;
  return (
    <p className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2 tabular-nums", className)}>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">{metaSeparator(locale).trim()}</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

export function Heading({ level, className, children }: { level: 2 | 3; className?: string; children: ReactNode }) {
  const Tag = level === 2 ? "h2" : "h3";
  return <Tag className={cx("text-balance", className)}>{children}</Tag>;
}
