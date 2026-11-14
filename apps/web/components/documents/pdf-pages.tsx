"use client";

import { useTranslations } from "next-intl";
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
  const box = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const element = box.current;
    let destroy: (() => void) | null = null;

    void (async () => {
      try {
        const pdfjs = await load();
        // pdf.js takes the buffer over; it gets a copy so a re-render still has the original.
        const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
        destroy = () => void task.destroy();
        const pdf = await task.promise;
        if (cancelled || !element) return;
        setPages(pdf.numPages);
        const width = Math.min(element.clientWidth || MAX_PAGE_WIDTH, MAX_PAGE_WIDTH);
        const ratio = window.devicePixelRatio || 1;
        for (let number = 1; number <= pdf.numPages; number += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(number);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = element.querySelector<HTMLCanvasElement>(`canvas[data-page="${number}"]`);
          if (!canvas) continue;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvas, viewport }).promise;
        }
      } catch {
        if (!cancelled) onError();
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [data, load, onError]);

  return (
    <div ref={box} className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
      {Array.from({ length: pages }, (_, index) => (
        <figure key={index} className="m-0">
          <canvas
            data-page={index + 1}
            role="img"
            aria-label={`${title} · ${t("page", { page: index + 1, pages })}`}
            // The copy is for viewing: no right-click "Save image".
            onContextMenu={(event) => event.preventDefault()}
            className="block h-auto w-full rounded-md border border-text/15 bg-white shadow-sm"
          />
          <figcaption className="mt-1 text-center text-xs text-text-secondary">
            {t("page", { page: index + 1, pages })}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
