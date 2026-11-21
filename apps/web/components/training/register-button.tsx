"use client";

import { courseRegisterResponseSchema, errorResponseSchema } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { slugOrNothing } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";

/**
 * The register button of a course page (§6.7). The server decides the seat
 * (`register_for_course`); this only sends the request and shows the answer.
 * Afterwards the page is refreshed, so the seats left and the registered
 * state come from the server, never from what this button assumed.
 */
export function RegisterButton({ courseId }: { courseId: string }) {
  const t = useTranslations("Training.register");
  const router = useRouter();
  // The course page's own slug, for analytics only.
  const params = useParams<{ slug?: string }>();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/register`, { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const registered = response.ok ? courseRegisterResponseSchema.safeParse(body) : null;
      if (registered?.success) {
        // Only a new registration counts, not "already registered".
        if (registered.data.outcome === "registered") {
          const slug = slugOrNothing(params?.slug);
          track("course_registered", slug ? { course_slug: slug } : {});
        }
        setDone(true);
      } else {
        const parsed = errorResponseSchema.safeParse(body);
        setError(parsed.success ? parsed.data.error.message : t("failed"));
      }
      // Either way the page's seats and state may have changed.
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
    setSending(false);
  }

  if (done) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckIcon aria-hidden="true" className="size-3.5" />
        {t("justRegistered")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={register} loading={sending} loadingLabel={t("registering")} className="w-full">
        {t("button")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
