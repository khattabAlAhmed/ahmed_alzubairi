import Image from "next/image";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/** A card on a listing page. The whole card is the link target when it has one. */
export const LISTING_CARD =
  "relative flex flex-col overflow-hidden rounded-lg border border-text/10 bg-surface text-text shadow-sm";

/** A card's title link. Its ::after covers the card, so the card is one target. */
export const TITLE_LINK =
  "rounded-sm after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Actions inside a card sit above the title link's overlay. */
export const ABOVE_LINK = "relative z-10";

export type ListingImage = { src: string; alt: string };

/** The four photo crops (DESIGN.md "Imagery"). */
export const PHOTO_CROPS = {
  /** 4:5, for Ahmed. */
  portrait: "aspect-[4/5]",
  /** 3:2, for work: the field, workshops, meetings. */
  work: "aspect-[3/2]",
  /** 1:1, for a detail. */
  detail: "aspect-square",
  /** 16:9, for quiet backgrounds, and listing cards. */
  wide: "aspect-video",
} as const;

export type PhotoCrop = keyof typeof PHOTO_CROPS;

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

/** Short facts on one line, split by a dot, wrapping on phones. */
export function MetaLine({ items: all, className }: { items: ReactNode[]; className?: string }) {
  const items = all.filter(Boolean);
  if (items.length === 0) return null;
  return (
    <p className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary", className)}>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
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
