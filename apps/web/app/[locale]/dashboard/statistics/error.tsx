"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

/**
 * The statistics page failed (e.g. the profile's time zone couldn't be
 * read). The retry is Next's `retry()`, which fetches the segment again and
 * re-runs the server read; `reset()` would only re-render the error it
 * already has.
 */
export default function StatisticsError({ retry }: { retry: () => void }) {
  const t = useTranslations("Error");

  return (
    <section role="alert" className="border border-ink/10 bg-surface p-6">
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="mt-2 max-w-prose text-ink-2">{t("description")}</p>
      <Button variant="secondary" className="mt-4" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </section>
  );
}
