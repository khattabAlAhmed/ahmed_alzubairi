"use client";

import {
  errorResponseSchema,
  newsletterSubscribeRequestSchema,
  type NewsletterSource,
} from "@repo/shared";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/icons";
import { Button, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { routing } from "@/i18n/routing";

/** The form's words, in the page's language. `NewsletterSignup` fills them in. */
export type NewsletterFormLabels = {
  email: string;
  subscribe: string;
  subscribing: string;
  required: string;
  emailInvalid: string;
  networkError: string;
  internalError: string;
  done: string;
};

/**
 * The newsletter signup form (§6.15): an email and a button. After a send it
 * shows one fixed text, whatever the address's state, so the form never tells
 * who is subscribed (§9). The address is never sent to analytics.
 */
export function NewsletterForm({
  source,
  labels,
  compact = false,
  className,
}: {
  source: NewsletterSource;
  labels: NewsletterFormLabels;
  /**
   * The inline signup after an article: the label is read by screen readers
   * only, and the button is the quiet outline (NewsletterSignup board).
   */
  compact?: boolean;
  className?: string;
}) {
  const pageLocale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const doneText = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (done) doneText.current?.focus();
  }, [done]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter in the field submits too, so a second send is blocked here as well.
    if (sending) return;
    const form = event.currentTarget;
    const raw = new FormData(form).get("email");
    const email = typeof raw === "string" ? raw.trim() : "";
    const locale = routing.locales.find((known) => known === pageLocale) ?? routing.defaultLocale;
    const parsed = newsletterSubscribeRequestSchema.safeParse({ email, locale, source });
    if (!parsed.success) {
      setError(email ? labels.emailInvalid : labels.required);
      form.querySelector<HTMLElement>('[name="email"]')?.focus();
      return;
    }

    setError(null);
    setSending(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        setDone(true);
      } else {
        const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
        setError(body.success ? body.data.error.message : labels.internalError);
      }
    } catch {
      setError(labels.networkError);
    }
    setSending(false);
  }

  if (done) {
    // One fixed text whatever the address's state: "check your email" (double opt-in).
    return (
      <p
        ref={doneText}
        role="status"
        tabIndex={-1}
        className={cx("flex items-start gap-2 text-pretty type-small focus:outline-none", className)}
      >
        <CheckIcon aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 text-success" />
        <span>{labels.done}</span>
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cx("grid grid-cols-[minmax(0,1fr)_auto] items-start", className)}
    >
      <TextField
        name="email"
        type="email"
        label={labels.email}
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        required
        error={error ?? undefined}
        className={cx("min-w-0", compact && "[&>label]:sr-only")}
      />
      {/* Joined to the field and level with the input: under the label (24px line + 8px gap) when it shows. */}
      <Button
        type="submit"
        variant={compact ? "secondary" : "primary"}
        loading={sending}
        loadingLabel={labels.subscribing}
        className={compact ? undefined : "mt-8"}
      >
        {labels.subscribe}
      </Button>
    </form>
  );
}
