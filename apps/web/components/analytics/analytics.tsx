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
import { replayAllowed } from "@/lib/analytics/replay";
import { trackerOff, trackerStarted } from "@/lib/analytics/track";

type Idle = (callback: () => void) => number;

/**
 * How long after the page's `load` event the session recorder may start. Its
 * first snapshot is a long task, so it waits until the page has settled (TBT).
 */
export const RECORDING_DELAY_MS = 5000;

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
 * first paint. The session recorder starts later: 5 s after `load`, and only
 * on a public page. Moving to a private page before then cancels the pending
 * start, so the recorder never runs there. Renders nothing. Without a key
 * (`/api/posthog-config` 204) it stays off and the site works the same. Never
 * calls `identify` (§9).
 */
function Tracker() {
  const pathname = usePathname();
  const posthog = useRef<PosthogLike | null>(null);
  const path = useRef(pathname);
  const consent = useRef<Consent | null>(null);
  // When the page's `load` event fired (ms), null before.
  const loadedAt = useRef<number | null>(null);
  // True once the delay has passed on a public page: the recorder may run.
  const recordingReady = useRef(false);
  const pending = useRef<number | null>(null);

  const cancelPending = () => {
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
  };

  // Schedules the recorder's start for 5 s after `load`, on a public page.
  const armRecording = () => {
    if (recordingReady.current || pending.current !== null || loadedAt.current === null) return;
    if (!replayAllowed(path.current)) return;
    const delay = Math.max(0, loadedAt.current + RECORDING_DELAY_MS - Date.now());
    pending.current = window.setTimeout(() => {
      pending.current = null;
      if (!replayAllowed(path.current)) return;
      recordingReady.current = true;
      if (posthog.current) syncRecording(posthog.current, path.current);
    }, delay);
  };

  useEffect(() => {
    let cancelled = false;
    consent.current = readConsent();

    const onLoad = () => {
      loadedAt.current = Date.now();
      armRecording();
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

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
      if (recordingReady.current) syncRecording(instance, path.current);
    };
    const idle: Idle =
      typeof window.requestIdleCallback === "function"
        ? (callback) => window.requestIdleCallback(callback, { timeout: 3000 })
        : (callback) => window.setTimeout(callback, 1);
    const handle = idle(() => void start());

    return () => {
      cancelled = true;
      window.removeEventListener(CONSENT_EVENT, onConsent);
      window.removeEventListener("load", onLoad);
      cancelPending();
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  useEffect(() => {
    path.current = pathname;
    if (!replayAllowed(pathname)) cancelPending();
    else armRecording();
    if (posthog.current && recordingReady.current) syncRecording(posthog.current, pathname);
  }, [pathname]);

  return null;
}
