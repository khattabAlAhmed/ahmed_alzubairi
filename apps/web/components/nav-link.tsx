"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { isActivePath } from "./nav-items";

export function NavLink({
  href,
  ...props
}: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      aria-current={isActivePath(pathname, href) ? "page" : undefined}
      {...props}
    />
  );
}
