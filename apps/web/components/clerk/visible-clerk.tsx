"use client";

import { memo, useEffect, useState, type ReactNode } from "react";

const Held = memo(
  function Held({ children }: { children: ReactNode; shown: boolean }) {
    return children;
  },
  // Hidden: keep the last render as it is, whatever the new children.
  (_, next) => !next.shown,
);

/**
 * Wraps a Clerk provider whose layout Next may keep mounted but hidden after
 * a client navigation (React `<Activity>`). A hidden tree's effects are off,
 * yet it still re-renders when Next refreshes the router, for example after
 * sign-out.
 *
 * A hidden Clerk provider must not render. Every render of `@clerk/nextjs`'s
 * provider claims the one global navigation function Clerk's UI awaits
 * (`window.__clerk_internal_navigations`). With its effects off, the hidden
 * one never settles the navigations it starts. So after signing out from the
 * account, a sign-up stalled before the code step (P8D-T27). Hidden, this
 * holds its last render. Shown again, it renders with the latest children.
 *
 * Public pages don't need it: their provider sits beside the page, and
 * `LazyClerk` drops it when hidden.
 */
export function VisibleClerk({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const show = () => setShown(true);
    show();
    return () => setShown(false);
  }, []);
  return <Held shown={shown}>{children}</Held>;
}
