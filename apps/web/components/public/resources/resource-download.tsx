"use client";

import type { ResourceAccess } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { CheckIcon, DownloadIcon } from "@/components/icons";
import { Button, Checkbox, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { RESOURCE_ACTION, RESOURCE_BELOW } from "../listing/resource-card";
import { requestDownload, startDownload } from "./api";
import { track } from "@/lib/analytics/track";

/**
 * A resource row's action (§6.9, ResourceItem board). A direct resource
 * downloads in one click. An email-gated one opens the email form under the
 * row first, and downloads only once the server has accepted the email. The
 * root is `display: contents`, so its parts take their places in the row's
 * grid (`RESOURCE_ACTION`, `RESOURCE_BELOW`).
 */
export function ResourceDownload({ id, title, access }: { id: string; title: string; access: ResourceAccess }) {
  const t = useTranslations("Resources");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState(false);
  // Each press of "Download by email" starts a fresh form, also after a
  // finished download, but never while the form's request is still out.
  const [gate, setGate] = useState(0);
  const [gateBusy, setGateBusy] = useState(false);
  const openGate = () => {
    if (gateBusy) return;
    setGate((n) => n + 1);
    setOpen(true);
  };

  async function download() {
    setBusy(true);
    setError(null);
    setStarted(false);
    const result = await requestDownload(id);
    setBusy(false);
    if (result.ok) {
      track("resource_downloaded", { resource_access: "direct" });
      setStarted(true);
      startDownload(result.url);
      // A request with no body is only ever invalid for want of the email: the
      // resource became email-gated after the page was cached. Ask for it.
    } else if (result.code === "validation_failed") openGate();
    else setError(result.message ?? t("failed"));
  }

  return (
    <div className="contents">
      <Button
        variant="secondary"
        size="sm"
        className={RESOURCE_ACTION}
        loading={busy}
        loadingLabel={t("preparing")}
        aria-label={t(access === "email" ? "downloadByEmailLabel" : "downloadLabel", { title })}
        aria-expanded={access === "email" ? open : undefined}
        onClick={access === "email" ? openGate : download}
      >
        <DownloadIcon aria-hidden="true" className="size-4" />
        {t(access === "email" ? "downloadByEmail" : "download")}
      </Button>
      <p role="status" className={cx(RESOURCE_BELOW, "flex items-center gap-1.5 text-sm text-success empty:hidden")}>
        {started ? (
          <>
            <CheckIcon aria-hidden="true" className="size-3.5" />
            {t("started")}
          </>
        ) : null}
      </p>
      {error && (
        <p role="alert" className={cx(RESOURCE_BELOW, "text-sm font-medium text-danger")}>
          {error}
        </p>
      )}
      {open && (
        <EmailGate
          key={gate}
          id={id}
          title={title}
          onClose={() => setOpen(false)}
          onBusyChange={setGateBusy}
          className={RESOURCE_BELOW}
        />
      )}
    </div>
  );
}

type GateState = { step: "form"; error: string | null } | { step: "sending" } | { step: "done" };

/**
 * The email form under the row, on the raised ground: the address (read LTR),
 * the newsletter box, never ticked for the visitor (§6.9, §9), and send. The
 * email goes only to the download route, and joins the newsletter only when
 * the visitor ticks the box.
 */
export function EmailGate({
  id,
  title,
  onClose,
  autoFocus = true,
  onBusyChange,
  className,
}: {
  id: string;
  title: string;
  /** Closes the form. Without it, the form has no cancel (the design-system page). */
  onClose?: () => void;
  /** The email field takes focus when the form opens. */
  autoFocus?: boolean;
  /** Told when the form's request starts and ends, so the opener doesn't restart it meanwhile. */
  onBusyChange?: (busy: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("Resources");
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<GateState>({ step: "form", error: null });
  const busy = state.step === "sending";
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setMissing(true);
      return;
    }
    setState({ step: "sending" });
    const result = await requestDownload(id, { email: address, consent });
    if (result.ok) {
      track("resource_downloaded", { resource_access: "email" });
      setState({ step: "done" });
      startDownload(result.url);
    } else setState({ step: "form", error: result.message ?? t("failed") });
  }

  if (state.step === "done") {
    return (
      <div className={cx("flex flex-col gap-1 bg-surface p-4", className)}>
        <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckIcon aria-hidden="true" className="size-3.5" />
          {t("started")}
        </p>
        <p className="text-pretty text-ink-2 type-small">{t("startedText")}</p>
        {onClose && (
          <Button variant="quiet" size="sm" onClick={onClose} className="self-start">
            {t("close")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose?.();
      }}
      className={cx("flex flex-col gap-3 bg-surface p-4", className)}
    >
      <h3 id={titleId} className="font-medium type-small">
        {t("gateTitle")}
        {/* The title is text, never HTML (§9). */}
        <span className="sr-only">: {title}</span>
      </h3>
      <p className="max-w-measure text-pretty text-ink-2 type-small">{t("gateIntro")}</p>
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
          <TextField
            type="email"
            label={t("email")}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setMissing(false);
              // A server error was about the old address; drop it with the edit.
              setState((current) => (current.step === "form" && current.error ? { step: "form", error: null } : current));
            }}
            error={missing ? t("emailRequired") : undefined}
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            required
            autoFocus={autoFocus}
          />
          <Button type="submit" loading={busy} loadingLabel={t("preparing")} className="sm:mb-px">
            {t("gateSubmit")}
          </Button>
        </div>
        <Checkbox
          name="newsletter"
          label={t("newsletterConsent")}
          hint={t("newsletterConsentHint")}
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
      </fieldset>
      {state.step === "form" && state.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {onClose && (
        <Button variant="quiet" size="sm" disabled={busy} onClick={onClose} className="self-start">
          {t("cancel")}
        </Button>
      )}
    </form>
  );
}
