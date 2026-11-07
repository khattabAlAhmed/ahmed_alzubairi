"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("Error");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="text-text-secondary">{t("description")}</p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-semibold text-on-accent"
      >
        {t("retry")}
      </button>
    </main>
  );
}
