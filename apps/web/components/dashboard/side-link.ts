import { cx } from "@/components/ui/cx";

/**
 * A link in the index sidebar (the AppShell board): ink-2, and the current
 * page in ink on the page ground with a 2px accent edge on its start side.
 * Shared with the dashboard's permission-based menu.
 */
export const SIDE_LINK = cx(
  "flex items-center justify-between gap-2 px-4.5 py-2.5 text-[15px] text-ink-2 transition-state hover:text-ink focus-ring",
  "focus-visible:-outline-offset-2 md:py-2",
  "aria-[current=page]:bg-bg aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_2px_0_0_var(--accent)] rtl:aria-[current=page]:shadow-[inset_-2px_0_0_var(--accent)]",
);
