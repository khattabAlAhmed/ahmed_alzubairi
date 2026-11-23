"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { CONSENT_EVENT, readConsent, type Consent } from "@/lib/analytics/consent";
import {
  applyConsent,
  fetchPosthogConfig,
  posthogOptions,
  syncRecording,
  type PosthogLike,
} from "@/lib/analytics/client";
import { trackerOff, trackerStarted } from "@/lib/analytics/track";

type Idle = (callback: () => void) => number;

/**
 * The provider, in its own Suspense boundary: it reads the path, which Cache
 * Components only allows inside one, and it must never hold the page back.
 */
export function Analytics() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}

/**
 * Starts PostHog in the browser once the page is idle, so it never delays the
 * first paint. Renders nothing. Without a key (`/api/posthog-config` 204) it
 * stays off and the site works the same. Never calls `identify` (§9).
 */
function Tracker() {
  const pathname = usePathname();
  const posthog = useRef<PosthogLike | null>(null);
  const path = useRef(pathname);
  const consent = useRef<Consent | null>(null);

  useEffect(() => {
    let cancelled = false;
    consent.current = readConsent();

    const onConsent = (event: Event) => {
      const choice = (event as CustomEvent<Consent>).detail;
      consent.current = choice;
      if (posthog.current) applyConsent(posthog.current, choice);
    };
    window.addEventListener(CONSENT_EVENT, onConsent);

    const start = async () => {
      const config = await fetchPosthogConfig();
      if (cancelled) return;
      if (!config) {
        trackerOff();
        return;
      }
      const { default: instance } = await import("posthog-js");
      if (cancelled) return;
      instance.init(config.key, posthogOptions(config, consent.current));
      posthog.current = instance;
      trackerStarted(instance);
      syncRecording(instance, path.current);
    };
    const idle: Idle =
      typeof window.requestIdleCallback === "function"
        ? (callback) => window.requestIdleCallback(callback, { timeout: 3000 })
        : (callback) => window.setTimeout(callback, 1);
    const handle = idle(() => void start());

    return () => {
      cancelled = true;
      window.removeEventListener(CONSENT_EVENT, onConsent);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  useEffect(() => {
    path.current = pathname;
    if (posthog.current) syncRecording(posthog.current, pathname);
  }, [pathname]);

  return null;
}
