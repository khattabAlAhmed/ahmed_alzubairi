/** Joins class names, skipping empty ones. */
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * One focus ring for every interactive component: the `focus-ring` utility in
 * globals.css (2px `focus`, 3px offset, solid; DESIGN.md "States").
 */
export const FOCUS_RING = "focus-ring";

/*
 * Class strings shared by client and server components. They live here, in a
 * plain module, because a constant exported from a "use client" file can't be
 * read on the server.
 */

/** A link inside running text: accent, a 1px underline that thickens on hover, ink-2 once visited. */
export const INLINE_LINK =
  "text-accent underline decoration-1 underline-offset-5 transition-state hover:decoration-2 visited:text-ink-2 focus-ring";

/** A navigation link: ink-2, ink on hover, and the current page in ink with a 2px accent underline. */
export const NAV_LINK =
  "py-1.5 text-ink-2 no-underline transition-state hover:text-ink focus-ring " +
  "aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--accent)]";

/*
 * The Tabs board: single choice, a hairline under the row, and the chosen tab
 * in ink with a 2px accent underline. Different from filter chips, which are
 * multiple choice and carry a square.
 */
export const TAB_LIST = "flex overflow-x-auto border-b border-line [scrollbar-width:thin]";

export function tabClasses(active: boolean) {
  return cx(
    "inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 px-4.5 text-[15px] whitespace-nowrap transition-state focus-ring",
    "focus-visible:-outline-offset-2",
    active ? "text-ink shadow-[inset_0_-2px_0_var(--accent)]" : "text-ink-2 hover:text-ink",
  );
}
