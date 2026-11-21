"use client";

import { useLocale } from "next-intl";
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { signInPath, signUpPath } from "@/lib/auth/return-path";
import { onClerkRequest } from "./auth-state";

const PublicClerk = lazy(() => import("./public-clerk"));

/**
 * Clerk's chunk can fail to download. The island then renders nothing and the
 * public page stays as it is: its auth-aware controls keep the signed-out
 * state, which is always safe.
 */
class IslandBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error("Clerk didn't load on this page", error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The interactions that load Clerk at once: the visitor is using the page. */
export const FIRST_INTERACTION = ["pointerdown", "keydown", "touchstart"] as const;

/** Idle may never come on a busy page: load by then at the latest. */
export const IDLE_TIMEOUT_MS = 5000;

/**
 * Loads Clerk on public pages only once the page is idle, on the first
 * interaction, or when an auth-aware control asks for it (§13 Performance):
 * its scripts and the provider's own code then stay off the first paint.
 *
 * It sits beside the page, not around it, so loading Clerk never re-renders
 * or remounts the page. Public layouts still never read the session on the
 * server.
 */
export function LazyClerk() {
  const locale = useLocale();
  const [load, setLoad] = useState(false);

  // After a client navigation, Next keeps the previous layout mounted but
  // hidden (React `<Activity>`): its effects are cleaned up, yet it still
  // re-renders on every navigation (`useRouter()` reads LayoutRouterContext).
  // Hidden, the island drops Clerk; shown again, it brings it back at once if
  // it had loaded (clerk-js itself stays in the window). A hidden provider
  // used to take over Clerk's navigation and stall sign-up (P8D-T27). The
  // `@clerk/nextjs` patch fixes that for every layout (P8D-T29); this keeps a
  // hidden public page from re-rendering Clerk in the background for nothing.
  const loadedBefore = useRef(false);
  useEffect(() => () => setLoad(false), []);

  useEffect(() => {
    if (load) {
      loadedBefore.current = true;
      return;
    }
    const start = () => setLoad(true);
    if (loadedBefore.current) {
      start();
      return;
    }
    const stopRequests = onClerkRequest(start);
    for (const type of FIRST_INTERACTION) window.addEventListener(type, start, { once: true, passive: true });
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS })
        : window.setTimeout(start, IDLE_TIMEOUT_MS);
    return () => {
      stopRequests();
      for (const type of FIRST_INTERACTION) window.removeEventListener(type, start);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [load]);

  if (!load) return null;
  return (
    <IslandBoundary>
      <Suspense fallback={null}>
        <PublicClerk
          signInUrl={signInPath(locale)}
          signUpUrl={signUpPath(locale)}
          afterSignOutUrl={`/${locale}`}
        />
      </Suspense>
    </IslandBoundary>
  );
}
