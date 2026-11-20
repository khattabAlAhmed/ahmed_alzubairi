"use client";

import type { ComponentProps } from "react";
import { cx, NAV_LINK } from "@/components/ui/cx";
import { Link, usePathname } from "@/i18n/navigation";
import { isActivePath } from "./nav-items";

/*
 * The Link board's three kinds of link: INLINE_LINK and NAV_LINK live in
 * components/ui/cx.ts (readable on the server too), and the "more" link is
 * MoreLink in components/public/parts.tsx.
 */

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
