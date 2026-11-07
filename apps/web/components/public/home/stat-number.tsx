"use client";

import { useEffect, useMemo, useRef } from "react";
import { formatStatValue, parseStatValue } from "./stat-value";

/** Calm: long enough to notice, short enough not to wait for. */
export const COUNT_DURATION_MS = 1400;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts up to `value` the first time it scrolls into view (§13 Motion). The
 * server renders the final value, and it stays as is with reduced motion, no
 * IntersectionObserver, or a value with no single number. Screen readers get
 * the final value only.
 */
export function StatNumber({ value }: { value: string }) {
  const stat = useMemo(() => parseStatValue(value), [value]);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!stat || !element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / COUNT_DURATION_MS);
          element.textContent = formatStatValue(stat, stat.target * easeOut(progress));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    // Starts from zero only once the animation is sure to run. The count
    // writes to the DOM directly: one text change per frame, no re-render.
    element.textContent = formatStatValue(stat, 0);
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.textContent = value;
    };
  }, [stat, value]);

  return (
    // Isolated left to right, so "15+" doesn't turn into "+15" in Arabic.
    <span dir="ltr" className="relative inline-block tabular-nums">
      {/* The final value holds the width, so the row doesn't shift while counting. */}
      <span className="invisible" aria-hidden="true">
        {value}
      </span>
      <span ref={ref} className="absolute inset-0" aria-hidden="true" data-testid="stat-count">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
