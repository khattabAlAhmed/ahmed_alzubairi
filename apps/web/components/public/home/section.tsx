import type { ReactNode } from "react";
import { ArrowForwardIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

/**
 * `plain` and `raised` alternate down the page, so neighbouring sections stay
 * apart whatever order the dashboard sets. `navy` is the deep band of §13.
 */
export type SectionBand = "plain" | "raised" | "navy";

const BANDS: Record<SectionBand, string> = {
  plain: "bg-background text-text",
  raised: "bg-surface text-text",
  navy: "bg-primary text-on-primary",
};

/** A card that stands out from either band. */
export const CARD =
  "rounded-lg border border-text/10 bg-surface p-6 shadow-sm group-data-[band=raised]/band:bg-background";

/** A link on a card's title, with the whole card as its target. */
export const CARD_LINK =
  "rounded-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hover:underline";

export function sectionHeadingId(key: string) {
  return `home-${key}-title`;
}

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
  band: SectionBand;
  /** A link to the section's full page, after the heading. */
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  const headingId = sectionHeadingId(sectionKey);
  const navy = band === "navy";

  return (
    <section
      aria-labelledby={headingId}
      data-section={sectionKey}
      data-band={band}
      className={cx("group/band", BANDS[band])}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-64">
            {/* Gold as a divider, never as text (§13). */}
            <span aria-hidden="true" className="mb-3 block h-0.5 w-10 rounded-full bg-accent" />
            <h2 id={headingId} className="text-balance text-2xl md:text-3xl">
              {heading}
            </h2>
            {intro && (
              <p className={cx("mt-2 max-w-prose text-pretty", navy ? "text-on-primary/80" : "text-text-secondary")}>
                {intro}
              </p>
            )}
          </div>
          {action && (
            <Link
              href={action.href}
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2",
                navy ? "focus-visible:outline-accent" : "focus-visible:outline-ring",
              )}
            >
              {action.label}
              <ArrowForwardIcon aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
