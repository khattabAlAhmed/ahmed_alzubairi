"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Keeps the menu's unread count fresh without polling (§6.21). The dashboard
 * layout is not rendered again when the member moves between its pages, so
 * each move to another page asks the server for the layout once more.
 */
export function RefreshOnNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const shown = useRef(pathname);

  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    router.refresh();
  }, [pathname, router]);

  return null;
}
