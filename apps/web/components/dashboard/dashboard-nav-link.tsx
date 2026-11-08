"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { isActivePath } from "@/components/nav-items";
import { cx, FOCUS_RING } from "@/components/ui/cx";

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
      className={cx(
        // Long Arabic labels wrap on a phone; the md column keeps one line as before.
        "block rounded-md px-3 py-2.5 text-sm hover:bg-text/10 md:py-2 md:whitespace-nowrap",
        "aria-[current=page]:bg-text/10 aria-[current=page]:font-semibold",
        FOCUS_RING,
      )}
    >
      {children}
    </Link>
  );
}
