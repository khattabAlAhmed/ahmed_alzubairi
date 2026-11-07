import type { ReactNode } from "react";
import { ArrowForwardIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

/**
 * Layout pieces for the T06 pages: projects, clients, documents and FAQ.
 * They match T05's page parts, so every public page has the same top and
 * body. Merge the two once both PRs are in.
 */
export const CONTAINER = "mx-auto w-full max-w-7xl px-4";

export const CARD = "relative rounded-lg border border-text/10 bg-surface p-6 shadow-sm";

/** A card link whose whole card is the target. */
export const CARD_LINK =
  "rounded-sm after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const TEXT_LINK =
  "inline-flex items-center gap-1.5 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

/** The top of a page on the navy band (§13). */
export function PageHero({
  eyebrow,
  back,
  title,
  intro,
}: {
  eyebrow?: string;
  back?: { href: string; label: string };
  title: string;
  intro?: ReactNode;
}) {
  return (
    <header className="bg-primary text-on-primary">
      <div className={cx(CONTAINER, "py-12 md:py-16")}>
        {back && (
          <Link href={back.href} className={cx(TEXT_LINK, "mb-6 text-sm text-on-primary/85 focus-visible:outline-accent")}>
            {/* Points back: the forward arrow, turned around. */}
            <ArrowForwardIcon aria-hidden="true" className="size-4 rotate-180" />
            {back.label}
          </Link>
        )}
        {eyebrow && (
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-primary/85">
            <span aria-hidden="true" className="h-0.5 w-8 shrink-0 rounded-full bg-accent" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-3xl leading-tight md:text-5xl">{title}</h1>
        {intro && <div className="mt-4 max-w-prose text-pretty text-lg text-on-primary/85">{intro}</div>}
      </div>
    </header>
  );
}

/** A titled block in a page's body. */
export function PageSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <span aria-hidden="true" className="mb-3 block h-0.5 w-10 rounded-full bg-accent" />
      <h2 id={id} className="text-balance text-2xl md:text-3xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Plain text from a long-text field, keeping the editor's line breaks. */
export function TextBlock({ text }: { text: string }) {
  return <p className="max-w-prose whitespace-pre-line text-pretty leading-relaxed">{text}</p>;
}

/** What a list page shows when nothing is published in this language. */
export function EmptyNote({ text }: { text: string }) {
  return <p className="text-text-secondary">{text}</p>;
}
