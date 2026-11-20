import type { ReactNode } from "react";
import { CONTAINER, SectionHead } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";

/**
 * Kept for the home page's callers. Every section now sits on the page ground,
 * opened by its rule (the SectionShell board): the navy and raised bands are
 * gone, and neighbouring sections stay apart by the space between them.
 */
export type SectionBand = "plain" | "raised" | "navy";

/**
 * A bounded item, until Lane A gives each home list its own record shape.
 * Square, a hairline edge, on the page ground: no shadow, no raised fill.
 */
export const CARD = "relative border border-line bg-bg p-6";

/** A link on a card's title, with the whole card as its target. */
export const CARD_LINK = "after:absolute after:inset-0 hover:underline focus-ring";

/** The id a home section's h2 gets, for its `aria-labelledby`. */
export function sectionHeadingId(key: string) {
  return `home-${key}-title`;
}

/**
 * A home section (the SectionShell board): the rule, the title, a line of his,
 * "see all" with the count, then the content. It stands alone, so the
 * dashboard can hide or reorder it without breaking its neighbours; an empty
 * section is never rendered (the caller leaves it out).
 */
export function HomeSectionShell({
  sectionKey,
  heading,
  intro,
  band,
  action,
  children,
}: {
  sectionKey: string;
  heading: string;
  intro?: string;
  /** No longer changes the look; see `SectionBand`. */
  band: SectionBand;
  /** "See all", to the section's full page, with its count in the page's digits. */
  action?: { href: string; label: string; count?: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={sectionHeadingId(sectionKey)} data-section={sectionKey} data-band={band} className={cx(CONTAINER, "mt-section")}>
      <SectionHead id={sectionHeadingId(sectionKey)} title={heading} intro={intro} more={action} />
      <div className="mt-8">{children}</div>
    </section>
  );
}
