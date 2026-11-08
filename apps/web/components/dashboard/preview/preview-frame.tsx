"use client";

import type { Locale } from "@repo/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The two widths the preview offers, in CSS pixels. */
export const PREVIEW_WIDTHS = { mobile: 375, desktop: 1280 } as const;

export type PreviewWidth = keyof typeof PREVIEW_WIDTHS;

/**
 * Copies the page's stylesheets and font variables into the frame, so the
 * public components look as they do on the site. The frame's own width
 * drives the breakpoints.
 */
function prepare(doc: Document) {
  for (const node of document.head.querySelectorAll('link[rel="stylesheet"], style')) {
    doc.head.appendChild(node.cloneNode(true));
  }
  // The font variables (next/font) live on <html>; the theme class is set apart.
  doc.documentElement.className = document.documentElement.className
    .split(/\s+/)
    .filter((name) => name !== "dark" && name !== "light")
    .join(" ");
  doc.body.className = "min-h-full bg-background text-text";
  // Links and forms are inert: nothing navigates away from the editor or posts.
  const block = (event: Event) => {
    const target = event.target as Element | null;
    if (event.type === "submit" || target?.closest?.("a, button[type=submit]")) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  doc.addEventListener("click", block, true);
  doc.addEventListener("submit", block, true);
}

/**
 * An iframe that renders `children` through a portal, at a real width, in
 * the given language, direction and theme. Scaled down to fit its column.
 */
export function PreviewFrame({
  title,
  locale,
  dark,
  width,
  children,
}: {
  title: string;
  locale: Locale;
  dark: boolean;
  width: PreviewWidth;
  children: ReactNode;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // The frame's document lives in a ref; `body` (state) only says it's ready.
  const doc = useRef<Document | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(600);
  const [available, setAvailable] = useState(0);
  const pixels = PREVIEW_WIDTHS[width];

  // Mount: an empty same-origin document, then the styles.
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    const ready = () => {
      const current = iframe.contentDocument;
      if (!current || current.body.dataset.ready) return;
      prepare(current);
      current.body.dataset.ready = "1";
      doc.current = current;
      setBody(current.body);
    };
    iframe.addEventListener("load", ready);
    if (iframe.contentDocument?.readyState === "complete") ready();
    return () => iframe.removeEventListener("load", ready);
  }, []);

  // Language, direction and theme follow the controls.
  useEffect(() => {
    const root = doc.current?.documentElement;
    if (!body || !root) return;
    root.setAttribute("lang", locale);
    root.setAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    root.classList.toggle("dark", dark);
    root.style.setProperty("color-scheme", dark ? "dark" : "light");
  }, [body, locale, dark]);

  // The frame grows with its content.
  useEffect(() => {
    const current = doc.current;
    if (!body || !current) return;
    const observer = new ResizeObserver(() =>
      setHeight(Math.max(200, current.documentElement.scrollHeight)),
    );
    observer.observe(current.body);
    return () => observer.disconnect();
  }, [body]);

  // The column's width sets the scale.
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = available > 0 ? Math.min(1, available / pixels) : 1;

  return (
    <div ref={box} className="overflow-hidden rounded-md border border-text/20" dir="ltr">
      <div style={{ height: height * scale, width: pixels * scale }} className="mx-auto">
        <iframe
          ref={frame}
          title={title}
          srcDoc="<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>"
          style={{
            width: pixels,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            border: 0,
            display: "block",
          }}
        />
      </div>
      {body && createPortal(children, body)}
    </div>
  );
}
