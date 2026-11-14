"use client";

import { useTranslations } from "next-intl";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

/**
 * Loads pdf.js only in the browser, with its worker. A function so tests can
 * replace it.
 */
export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

/** The widest a page is drawn, in CSS pixels. */
const MAX_PAGE_WIDTH = 900;

/**
 * One page, drawn once its canvas has mounted: the draw starts from the
 * canvas's own effect, so it can never run before React commits it.
 */
function PdfPage({
  pdf,
  number,
  label,
  onError,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  label: string;
  onError: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let cancelled = false;
    let cancelRender: (() => void) | null = null;
    void (async () => {
      try {
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const width = Math.min(element.parentElement?.clientWidth || MAX_PAGE_WIDTH, MAX_PAGE_WIDTH);
        const ratio = window.devicePixelRatio || 1;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        element.width = Math.floor(viewport.width);
        element.height = Math.floor(viewport.height);
        const task = page.render({ canvas: element, viewport });
        cancelRender = () => task.cancel();
        await task.promise;
      } catch (error) {
        // A cancelled render (unmount) is not a failure.
        if (!cancelled && (error as { name?: string })?.name !== "RenderingCancelledException") onError();
      }
    })();
    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [pdf, number, onError]);

  return (
    <canvas
      ref={canvas}
      data-page={number}
      role="img"
      aria-label={label}
      // The copy is for viewing: no right-click "Save image".
      onContextMenu={(event) => event.preventDefault()}
      className="block h-auto w-full rounded-md border border-text/15 bg-white shadow-sm"
    />
  );
}

/**
 * Every page of a PDF drawn to its own canvas, one under the other (§6.18).
 * There is no browser PDF toolbar, so no download or print button. The file
 * is already in memory: scrolling between pages needs no new URL.
 */
export function PdfPages({
  data,
  title,
  onError,
  load = loadPdfJs,
}: {
  data: ArrayBuffer;
  title: string;
  onError: () => void;
  load?: typeof loadPdfJs;
}) {
  const t = useTranslations("AccountDocuments.viewer");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    void (async () => {
      try {
        const pdfjs = await load();
        // Unmounted while pdf.js loaded: no task is started, so none is left behind.
        if (cancelled) return;
        // pdf.js takes the buffer over; it gets a copy so a re-render still has the original.
        const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
        destroy = () => void task.destroy();
        const loaded = await task.promise;
        if (!cancelled) setPdf(loaded);
      } catch {
        if (!cancelled) onError();
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [data, load, onError]);

  const pages = pdf?.numPages ?? 0;
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
      {pdf &&
        Array.from({ length: pages }, (_, index) => (
          <figure key={index} className="m-0">
            <PdfPage
              pdf={pdf}
              number={index + 1}
              label={`${title} · ${t("page", { page: index + 1, pages })}`}
              onError={onError}
            />
            <figcaption className="mt-1 text-center text-xs text-text-secondary">
              {t("page", { page: index + 1, pages })}
            </figcaption>
          </figure>
        ))}
    </div>
  );
}
