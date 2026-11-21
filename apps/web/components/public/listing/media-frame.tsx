"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronBackIcon, ChevronForwardIcon, CloseIcon, PlayIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";

/*
 * The MediaFrame board's two interactive parts. Labels come from the server
 * parent, so these islands need no message bundle.
 */

export type SheetImage = { src: string; alt: string; caption?: string | null };

/**
 * A video before it loads: the poster and one play button. The player loads
 * only on a click (lighter on weak networks), and a plain link to the video's
 * own page stays for when it won't play.
 */
export function VideoFacade({
  src,
  title,
  poster,
  playLabel,
  fallback,
  className,
}: {
  /** A safe embed URL, built by the page from an allowed host. */
  src: string;
  title: string;
  poster: { src: string; alt: string } | null;
  /** "Play the interview", with the length when known. */
  playLabel: string;
  /** The video on its own site. */
  fallback?: { href: string; label: string };
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {playing ? (
        <div className="relative aspect-video bg-surface">
          <iframe
            src={autoplay(src)}
            title={title}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            className="absolute inset-0 size-full border-0"
          />
        </div>
      ) : (
        <div className="relative aspect-video bg-surface">
          {poster ? (
            <Image src={poster.src} alt={poster.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          ) : (
            <div aria-hidden="true" className="size-full bg-[repeating-linear-gradient(135deg,var(--surface)_0_10px,var(--bg)_10px_20px)]" />
          )}
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex items-end justify-start p-4 focus-ring focus-visible:-outline-offset-4"
          >
            <span className="inline-flex items-center gap-2 bg-bg px-3.5 py-2.5 text-sm text-ink transition-state group-hover:bg-surface-hover">
              <PlayIcon aria-hidden="true" className="size-3.5" />
              {playLabel}
            </span>
          </button>
        </div>
      )}
      {fallback && (
        <a
          href={fallback.href}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-[13px] text-ink-2 underline decoration-1 underline-offset-5 transition-state hover:text-ink focus-ring"
        >
          {fallback.label}
        </a>
      )}
    </div>
  );
}

/** Starts the player on load, since the visitor already pressed play. */
function autoplay(src: string): string {
  try {
    const url = new URL(src);
    url.searchParams.set("autoplay", "1");
    return url.href;
  } catch {
    return src;
  }
}

/**
 * The contact sheet: square photos in a row of four (two on phones), each
 * numbered, the caption under it. A missing photo shows the hatched panel. A
 * click opens the photo whole, with its caption; the arrows move between them.
 */
export function ContactSheet({
  images,
  labels,
  className,
}: {
  /** `null` for a photo that isn't uploaded yet. */
  images: (SheetImage | null)[];
  labels: {
    /** One per image: "Open photo 3". */
    open: string[];
    close: string;
    previous: string;
    next: string;
    /** One per uploaded photo, in order: "3 of 12". */
    position: string[];
    missing: string;
  };
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = images.flatMap((image, index) => (image ? [{ image, index }] : []));

  return (
    <>
      <ul className={cx("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
        {images.map((image, index) => (
          <li key={index}>
            <figure className="flex flex-col gap-1">
              {image ? (
                <button
                  type="button"
                  onClick={() => setOpen(index)}
                  aria-label={labels.open[index]}
                  className="relative block aspect-square bg-surface focus-ring"
                >
                  <Image src={image.src} alt={image.alt} fill sizes="(min-width: 640px) 20vw, 50vw" className="object-cover" />
                </button>
              ) : (
                <div className="flex aspect-square items-center justify-center border border-line bg-[repeating-linear-gradient(135deg,var(--surface)_0_10px,var(--bg)_10px_20px)] p-2 text-center text-[13px] text-ink-2">
                  {labels.missing}
                </div>
              )}
              <figcaption className="flex justify-between gap-2 text-xs text-ink-2">
                <span className="truncate">{image?.caption ?? "—"}</span>
                <span dir="ltr" className="font-mono">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {open !== null && images[open] && (
        <Lightbox
          shown={shown}
          at={shown.findIndex((item) => item.index === open)}
          onMove={(index) => setOpen(index)}
          onClose={() => setOpen(null)}
          labels={labels}
        />
      )}
    </>
  );
}

function Lightbox({
  shown,
  at,
  onMove,
  onClose,
  labels,
}: {
  shown: { image: SheetImage; index: number }[];
  at: number;
  onMove: (index: number) => void;
  onClose: () => void;
  labels: { close: string; previous: string; next: string; position: string[] };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { image } = shown[at];
  const previous = at > 0 ? shown[at - 1].index : null;
  const next = at < shown.length - 1 ? shown[at + 1].index : null;

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open && typeof element.showModal === "function") element.showModal();
    return () => {
      if (element?.open) element.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    // The arrows follow the reading direction: "next" is to the left in Arabic.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forward && next !== null) onMove(next);
    else if (event.key === back && previous !== null) onMove(previous);
  }

  const control =
    "inline-flex size-11 items-center justify-center border border-line-strong bg-bg text-ink transition-state hover:bg-surface-hover disabled:opacity-40 focus-ring";

  return (
    <dialog
      ref={dialog}
      aria-label={image.caption ?? image.alt}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={onKeyDown}
      className="m-auto w-[min(64rem,calc(100%-2rem))] border-t-2 border-rule bg-bg p-0 text-ink shadow-overlay backdrop:bg-scrim"
    >
      <figure>
        <div className="relative aspect-[3/2] bg-surface">
          <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 64rem, 100vw" className="object-contain" />
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-3 p-4 text-[13px] text-ink-2">
          <span>{image.caption}</span>
          <span className="tabular-nums">{labels.position[at]}</span>
        </figcaption>
      </figure>
      <div className="flex justify-between gap-2 border-t border-line p-4">
        <div className="flex gap-2">
          <button type="button" className={control} disabled={previous === null} onClick={() => previous !== null && onMove(previous)} aria-label={labels.previous}>
            <ChevronBackIcon aria-hidden="true" className="dir-icon size-5" />
          </button>
          <button type="button" className={control} disabled={next === null} onClick={() => next !== null && onMove(next)} aria-label={labels.next}>
            <ChevronForwardIcon aria-hidden="true" className="dir-icon size-5" />
          </button>
        </div>
        <button type="button" className={control} onClick={onClose} aria-label={labels.close}>
          <CloseIcon aria-hidden="true" className="size-5" />
        </button>
      </div>
    </dialog>
  );
}
