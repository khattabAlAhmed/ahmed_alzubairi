"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { isActivePath } from "@/components/nav-items";
import { SIDE_LINK } from "./side-link";

/**
 * A dashboard menu link. The overview (`exact`) is current only on its own
 * page, not on every page under `/dashboard`.
 */
export function DashboardNavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = exact ? pathname === href : isActivePath(pathname, href);

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      // Long Arabic labels wrap on a phone; the md column keeps one line.
      className={`${SIDE_LINK} md:whitespace-nowrap`}
    >
      {children}
    </Link>
  );
}
