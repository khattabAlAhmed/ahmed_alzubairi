"use client";

import { useLocale } from "next-intl";
import ar from "@/messages/ar/Blog.json";
import en from "@/messages/en/Blog.json";
import { ErrorState } from "@/components/feedback/error-state";
import { CONTAINER } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Button } from "@/components/ui";

/**
 * The articles didn't load (the ListStates board's error): the header and
 * footer still work, so this says so and offers a retry. Covers the list and
 * an article.
 * The retry is Next's `retry()`, which fetches the segment again; `reset()`
 * would only re-render the error it already has.
 */
export default function BlogError({ retry }: { retry: () => void }) {
  // The browser gets only the layout's namespaces, so the error copy comes
  // from the message files themselves.
  const copy = (useLocale() === "ar" ? ar : en).error;
  return (
    <main id={MAIN_CONTENT_ID} className={`${CONTAINER} flex-1 py-section`}>
      <ErrorState
        size="section"
        title={copy.title}
        text={copy.text}
        action={
          <Button variant="secondary" size="sm" onClick={() => retry()}>
            {copy.retry}
          </Button>
        }
      />
    </main>
  );
}
