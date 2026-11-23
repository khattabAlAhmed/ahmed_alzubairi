"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui";

/**
 * The statistics page failed (e.g. the profile's time zone couldn't be
 * read). Retry re-runs the server read: `reset` alone would only re-render
 * what was already fetched.
 */
export default function StatisticsError({ reset }: { reset: () => void }) {
  const t = useTranslations("Error");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section role="alert" className="border border-ink/10 bg-surface p-6">
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="mt-2 max-w-prose text-ink-2">{t("description")}</p>
      <Button
        variant="secondary"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        {t("retry")}
      </Button>
    </section>
  );
}
