"use client";

import type { DocumentAccessMode } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { InlineNotice } from "@/components/account/notice";
import { ErrorState } from "@/components/feedback/error-state";
import { Button, Skeleton } from "@/components/ui";
import { downloadUrl, openDocument } from "./api";
import { PdfPages } from "./pdf-pages";

type Loaded =
  | { kind: "pdf"; data: ArrayBuffer }
  | { kind: "image"; url: string };

type State = { step: "loading" } | { step: "ready"; file: Loaded } | { step: "failed"; message: string | null };

/** The file at a signed URL, as bytes. Throws on any non-2xx, such as an expired link. */
async function fetchBytes(url: string, fetchImpl: typeof fetch): Promise<ArrayBuffer> {
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`file fetch ${response.status}`);
  return response.arrayBuffer();
}

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** A safe file name for the download: the title's letters and digits, then the type's extension. */
export function downloadName(title: string, mime: string): string {
  const base = title
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "document"}.${EXTENSIONS[mime] ?? "bin"}`;
}

/**
 * Opens one granted document (§6.18): `GET /api/documents/:id/open` checks
 * the grant, logs the view and returns a 60-second signed URL to a copy
 * carrying the client's name and the date. A PDF is fetched once and drawn
 * with pdf.js; an image is shown as is. If the link has run out before the
 * file loads, the document is opened again, once. "تحميل" shows only for
 * عرض وتحميل, and asks the route for a download, which it refuses for عرض
 * فقط. The watermark is in the file; nothing is drawn over it here.
 */
export function DocumentViewer({
  documentId,
  title,
  mime,
  accessMode,
  fetchImpl = fetch,
}: {
  documentId: string;
  title: string;
  mime: string;
  accessMode: DocumentAccessMode;
  fetchImpl?: typeof fetch;
}) {
  const t = useTranslations("AccountDocuments.viewer");
  const [state, setState] = useState<State>({ step: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const isPdf = mime === "application/pdf";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Two tries: the second gets a fresh URL if the first ran out before the file came.
      for (let tries = 0; tries < 2; tries += 1) {
        const opened = await openDocument(documentId, "view", fetchImpl);
        if (cancelled) return;
        if (!opened.ok) {
          setState({ step: "failed", message: opened.message });
          return;
        }
        if (!isPdf) {
          setState({ step: "ready", file: { kind: "image", url: opened.body.url } });
          return;
        }
        try {
          const data = await fetchBytes(opened.body.url, fetchImpl);
          if (cancelled) return;
          setState({ step: "ready", file: { kind: "pdf", data } });
          return;
        } catch {
          // The link may have run out: open again.
        }
      }
      if (!cancelled) setState({ step: "failed", message: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, isPdf, fetchImpl, attempt]);

  const retry = useCallback(() => {
    setState({ step: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  const failed = useCallback(() => setState({ step: "failed", message: null }), []);

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    const opened = await openDocument(documentId, "download", fetchImpl);
    setDownloading(false);
    if (!opened.ok) {
      setDownloadError(opened.message ?? t("failed"));
      return;
    }
    window.location.assign(downloadUrl(opened.body.url, downloadName(title, mime)));
  }

  // The DocumentViewer board's frame: a bar opened by the heavy rule (title,
  // download), the pages on the surface ground, and the note
  // that every opening is logged and watermarked. Look only: opening,
  // watermarking, the 60-second link and the log are unchanged.
  return (
    <div className="flex flex-col border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-b border-rule border-b-line px-3.5 py-2.5">
        <p className="min-w-0 font-medium wrap-anywhere type-small">{title}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          {accessMode === "view_download" && (
            <Button variant="secondary" size="sm" loading={downloading} loadingLabel={t("downloading")} onClick={download}>
              {t("download")}
            </Button>
          )}
        </div>
      </div>
      {downloadError && (
        <div className="px-3.5 pt-3">
          <InlineNotice tone="danger" title={downloadError} />
        </div>
      )}

      <div className="bg-surface px-3 py-5 sm:px-5">
        {state.step === "loading" && (
          <div role="status">
            <span className="sr-only">{t("loading")}</span>
            <Skeleton className="mx-auto aspect-[1/1.414] w-full max-w-[900px] bg-bg!" />
          </div>
        )}
        {state.step === "failed" && (
          <ErrorState
            size="section"
            title={state.message ?? t("failed")}
            action={
              <Button variant="secondary" size="sm" onClick={retry}>
                {t("retry")}
              </Button>
            }
          />
        )}
        {state.step === "ready" && state.file.kind === "pdf" && (
          <PdfPages data={state.file.data} title={title} onError={failed} />
        )}
        {state.step === "ready" && state.file.kind === "image" && (
          // A signed Storage URL, so not next/image (its loader allows public media only).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.file.url}
            alt={t("imageAlt", { title })}
            onContextMenu={(event) => event.preventDefault()}
            onError={() => {
              // The link ran out before the image loaded: open again, once.
              if (attempt === 0) retry();
              else failed();
            }}
            className="mx-auto block h-auto max-w-full border border-line"
          />
        )}
      </div>

      <p className="border-t border-line px-3.5 py-2.5 text-[13px] leading-[1.7] text-ink-2">
        {t("watermark")}
        {accessMode === "view" && <> {t("viewOnly")}</>}
      </p>
    </div>
  );
}
