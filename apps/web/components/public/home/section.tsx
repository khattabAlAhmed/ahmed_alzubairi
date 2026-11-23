import type { ReactNode } from "react";
import { CONTAINER, SectionHead } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";

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
  action,
  children,
}: {
  sectionKey: string;
  heading: string;
  intro?: string;
  /** "See all", to the section's full page, with its count in the page's digits. */
  action?: { href: string; label: string; count?: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={sectionHeadingId(sectionKey)} data-section={sectionKey} className={cx(CONTAINER, "mt-section")}>
      <SectionHead id={sectionHeadingId(sectionKey)} title={heading} intro={intro} more={action} />
      <div className="mt-8">{children}</div>
    </section>
  );
}
