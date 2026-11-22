"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/feedback/error-state";
import { CONTAINER } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Button } from "@/components/ui";

/**
 * The projects didn't load (the ListStates board's error): the header and
 * footer still work, so this says so and offers a retry. Covers the list and
 * a project page.
 */
export default function ProjectsError({ reset }: { reset: () => void }) {
  const t = useTranslations("Catalog.projectsPage.error");
  return (
    <main id={MAIN_CONTENT_ID} className={`${CONTAINER} flex-1 py-section`}>
      <ErrorState
        size="section"
        title={t("title")}
        text={t("text")}
        action={
          <Button variant="secondary" size="sm" onClick={reset}>
            {t("retry")}
          </Button>
        }
      />
    </main>
  );
}
