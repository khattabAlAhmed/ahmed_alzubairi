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

type Cancel = () => void;

/** Runs `callback` when the browser is idle (at the latest after `timeout` ms). */
function whenIdle(callback: () => void, timeout: number): Cancel {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(callback, 1);
  return () => window.clearTimeout(handle);
}

/** Runs `callback` once the page has loaded, right away if it already has. */
function afterLoad(callback: () => void): Cancel {
  if (document.readyState === "complete") {
    callback();
    return () => {};
  }
  window.addEventListener("load", callback, { once: true });
  return () => window.removeEventListener("load", callback);
}

/** The longest PostHog waits for idle after `load` before it starts anyway. */
export const START_IDLE_TIMEOUT_MS = 3000;
/** The longest the recorder waits for idle after PostHog has started. */
export const RECORDING_IDLE_TIMEOUT_MS = 5000;

/**
 * Starts PostHog in the browser after the page has loaded and gone idle, so
 * it stays out of hydration and the first interactions (TBT). The session
 * recorder, the heaviest part, waits for one more idle period after that.
 * Events sent before the start wait in `track`'s queue with their own time
 * and page, so nothing is lost. Renders nothing. Without a key
 * (`/api/posthog-config` 204) it stays off and the site works the same.
 * Never calls `identify` (§9).
 */
function Tracker() {
  const pathname = usePathname();
  const posthog = useRef<PosthogLike | null>(null);
  const path = useRef(pathname);
  const consent = useRef<Consent | null>(null);
  // Set once the recorder may run: until then no page starts it.
  const recording = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const cancels: Cancel[] = [];
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
      // The recorder (its own script) starts on the next idle period, on the
      // page the visitor is on by then.
      cancels.push(
        whenIdle(() => {
          if (cancelled) return;
          recording.current = true;
          syncRecording(instance, path.current);
        }, RECORDING_IDLE_TIMEOUT_MS),
      );
    };
    cancels.push(afterLoad(() => cancels.push(whenIdle(() => void start(), START_IDLE_TIMEOUT_MS))));

    return () => {
      cancelled = true;
      window.removeEventListener(CONSENT_EVENT, onConsent);
      for (const cancel of cancels) cancel();
    };
  }, []);

  useEffect(() => {
    path.current = pathname;
    if (posthog.current && recording.current) syncRecording(posthog.current, pathname);
  }, [pathname]);

  return null;
}
