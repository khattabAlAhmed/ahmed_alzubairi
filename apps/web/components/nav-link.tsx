"use client";

import type { ComponentProps } from "react";
import { cx } from "@/components/ui/cx";
import { Link, usePathname } from "@/i18n/navigation";
import { isActivePath } from "./nav-items";

/*
 * The Link board's three kinds of link. The "more" link is MoreLink in
 * components/public/parts.tsx.
 */

/** A link inside running text: accent, a 1px underline that thickens on hover, ink-2 once visited. */
export const INLINE_LINK =
  "text-accent underline decoration-1 underline-offset-5 transition-state hover:decoration-2 visited:text-ink-2 focus-ring";

/** A navigation link: ink-2, ink on hover, and the current page in ink with a 2px accent underline. */
export const NAV_LINK = cx(
  "py-1.5 text-ink-2 no-underline transition-state hover:text-ink focus-ring",
  "aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--accent)]",
);

/**
 * A link that marks itself `aria-current="page"` on its own page. `look="nav"`
 * gives it the navigation style; without it the caller styles it.
 */
export function NavLink({
  href,
  look,
  className,
  ...props
}: ComponentProps<typeof Link> & { href: string; look?: "nav" }) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      aria-current={isActivePath(pathname, href) ? "page" : undefined}
      className={look === "nav" ? cx(NAV_LINK, className) : className}
      {...props}
    />
  );
}
