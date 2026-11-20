"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Button } from "@/components/ui";
import { cx, INLINE_LINK } from "@/components/ui/cx";

/** The height the open banner covers at the bottom of the screen, set on <html>. */
export const COVERED_VAR = "--consent-covered";

/**
 * The cookie banner's look. It holds no state: the caller decides when it is
 * open and what accepting or declining does.
 *
 * A labelled region, not a dialog: it doesn't trap focus or block the page.
 * Accept and decline have the same style and size, so declining is as easy
 * as accepting. On phones it stays short (one sentence, one row of buttons).
 *
 * It sits early in the page (right after the skip link), so keyboard users
 * reach it first, while it stays fixed at the bottom of the screen. The page
 * still ends with room for it: see `ConsentSpacer`.
 */
export function ConsentBanner({
  open,
  onAccept,
  onDecline,
  privacyHref,
  sample = false,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  privacyHref: string;
  /** The design-system page: in place instead of fixed, and it measures nothing. */
  sample?: boolean;
}) {
  if (!open) return null;
  return <OpenBanner onAccept={onAccept} onDecline={onDecline} privacyHref={privacyHref} sample={sample} />;
}

/**
 * Publishes how much of the screen's bottom the banner covers (its height,
 * plus the gap under it on wider screens) as a CSS variable on <html>, for
 * the spacer at the end of the page. Measured before paint, and again when
 * the banner's size changes (text wrapping, a breakpoint, the language).
 */
function useCoveredHeight(enabled = true) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const root = document.documentElement;
    const measure = () => {
      const covered = Math.max(0, Math.ceil(window.innerHeight - element.getBoundingClientRect().top));
      root.style.setProperty(COVERED_VAR, `${covered}px`);
    };
    measure();
    // Old browsers without ResizeObserver still measure on window resize.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty(COVERED_VAR);
    };
  }, [enabled]);
  return ref;
}

/**
 * After a choice made from inside the banner, focus goes to the page's
 * <main> (where the skip link goes) instead of falling to <body> when the
 * banner unmounts, so the next Tab continues into the content. Without
 * scrolling. The temporary tabindex goes once focus leaves.
 */
function focusMain() {
  const main = document.getElementById(MAIN_CONTENT_ID) ?? document.querySelector("main");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) {
    main.setAttribute("tabindex", "-1");
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
  }
  main.focus({ preventScroll: true });
}

function OpenBanner({
  onAccept,
  onDecline,
  privacyHref,
  sample,
}: {
  onAccept: () => void;
  onDecline: () => void;
  privacyHref: string;
  sample: boolean;
}) {
  const t = useTranslations("Consent");
  const ref = useCoveredHeight(!sample);
  // Move focus only when it is in the banner (a keyboard choice, or a click
  // that focused the button); a choice made otherwise leaves focus alone.
  const choose = (handler: () => void) => () => {
    const focusInside = ref.current?.contains(document.activeElement) ?? false;
    if (focusInside) focusMain();
    handler();
  };

  return (
    <section
      ref={ref}
      aria-label={t("label")}
      // The SkipAndConsent board: a calm bar along the bottom, never a wall. The
      // 2px rule opens it, and it is the one thing on the page with a shadow
      // (it floats over the content).
      className={cx("border-t-2 border-rule bg-bg text-ink shadow-overlay", !sample && "fixed inset-x-0 bottom-0 z-40")}
    >
      {/* Tighter on short screens, so it takes less of the view. */}
      <div
        className={cx(
          // The page column, as CONTAINER in public/parts.tsx (not imported: it would pull that module into the client bundle).
          "mx-auto w-full max-w-[calc(var(--container)+2*var(--page-margin))] px-page-margin",
          "flex flex-col gap-3 py-3 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:py-2",
          "sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:py-4",
        )}
      >
        <div className="min-w-0">
          <p className="type-small font-medium text-pretty">{t("text")}</p>
          <p className="type-caption text-pretty text-ink-2">
            {t("detail")}{" "}
            <Link href={privacyHref} className={cx(INLINE_LINK, "whitespace-nowrap")}>
              {t("privacy")}
            </Link>
            .
          </p>
        </div>
        {/* Same variant, same size: declining is as easy as accepting. */}
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={choose(onDecline)}>
            {t("decline")}
          </Button>
          <Button variant="secondary" size="sm" onClick={choose(onAccept)}>
            {t("accept")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * The end of the page, while the banner is open: as tall as the space it
 * covers, so every button and field can scroll above it. Rendered last in
 * <body>, while the banner itself sits early.
 *
 * CSS decides when it shows, so it is right before hydration too: only while
 * a consent wrapper (`[data-consent-banner]`, see ConsentChoice) holds a
 * banner and isn't `hidden`. The pre-paint script that hides the wrapper for
 * a visitor who already chose hides this with it. Its height is the measured
 * one once the banner has measured itself, an estimate a little taller than
 * the banner before (phones: 109–141 px, wider: 94 px).
 */
export function ConsentSpacer() {
  return (
    <div
      aria-hidden="true"
      data-consent-spacer=""
      className={cx(
        "hidden shrink-0 [body:has([data-consent-banner]:not([hidden])_section)_&]:block",
        "h-[var(--consent-covered,9rem)] sm:h-[var(--consent-covered,6rem)]",
      )}
    />
  );
}
