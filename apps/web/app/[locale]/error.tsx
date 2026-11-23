"use client";

import { useTranslations } from "next-intl";

/**
 * The last-resort error page for a locale. The retry is Next's `retry()`,
 * which fetches the segment again; `reset()` would only re-render the error
 * it already has.
 */
export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useTranslations("Error");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="text-ink-2">{t("description")}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex h-9 items-center bg-accent px-3 text-sm font-semibold text-on-accent"
      >
        {t("retry")}
      </button>
    </main>
  );
}
