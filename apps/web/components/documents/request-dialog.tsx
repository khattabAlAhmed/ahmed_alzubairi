"use client";

import { MAX_LONG_TEXT_LENGTH } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { InlineNotice } from "@/components/account/notice";
import { CheckIcon, CloseIcon, LockIcon } from "@/components/icons";
import { Button, ButtonLink, TextArea } from "@/components/ui";
import { onboardingPath } from "@/lib/auth/return-path";
import { track } from "@/lib/analytics/track";
import { sendDocumentRequest } from "./api";
import { MY_DOCUMENTS_PATH, requestPath } from "./paths";

export type DialogDocument = { id: string; title: string };

type State =
  | { step: "form"; error: string | null; profileNeeded: boolean }
  | { step: "sending" }
  | { step: "done" };

/**
 * The purpose dialog (§6.18 step 1). Submits `POST /api/document-requests`
 * for every selected document. A duplicate is merged by the server and shows
 * the same "طلبك قيد المراجعة" as a new request, never an error. A native
 * modal `<dialog>`, so focus stays inside and Esc closes it.
 */
export function RequestDialog({
  documents,
  onClose,
  onSent,
}: {
  documents: DialogDocument[];
  onClose: () => void;
  /** Called once the request is in, so the page can clear the selection. */
  onSent: () => void;
}) {
  const t = useTranslations("DocumentRequestDialog");
  const locale = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [purpose, setPurpose] = useState("");
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<State>({ step: "form", error: null, profileNeeded: false });
  const busy = state.step === "sending";
  const firstId = documents[0]?.id ?? "";

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) {
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    }
    return () => {
      if (element?.open && typeof element.close === "function") element.close();
      // The toolbar that opened it is gone once the selection clears: focus
      // the first document's own request button instead.
      const target = opener?.isConnected
        ? opener
        : document.querySelector<HTMLElement>(`[data-document-request="${firstId}"]`);
      target?.focus();
    };
  }, [firstId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = purpose.trim();
    if (!text) {
      setMissing(true);
      return;
    }
    setState({ step: "sending" });
    const result = await sendDocumentRequest(
      documents.map((document) => document.id),
      text,
    );
    if (result.ok) {
      track("document_requested", { count: documents.length });
      setState({ step: "done" });
      onSent();
      return;
    }
    const profileNeeded = result.code === "profile_incomplete";
    setState({
      step: "form",
      error: profileNeeded ? t("profileNeeded") : (result.message ?? t("failed")),
      profileNeeded,
    });
  }

  // The finished dialog closes from its footer, so its header has no second "Close".
  const header = (title: string, role?: "status") => (
    <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <h2 id={titleId} role={role} className="text-balance type-h3">
        {title}
      </h2>
      {role !== "status" && (
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        aria-label={t("close")}
        className="inline-flex size-11 shrink-0 items-center justify-center text-ink-2 transition-state hover:text-ink disabled:opacity-40 focus-ring"
      >
        <CloseIcon aria-hidden="true" className="size-5" />
      </button>
      )}
    </header>
  );
  const footer = "flex flex-wrap-reverse justify-end gap-2.5 border-t border-line px-5 py-3.5";

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      // DocumentRequestDialog board: the record's 2px rule on top, on the scrim; the one shadow on the page.
      className="m-auto w-[min(32.5rem,calc(100%-2rem))] border-t-2 border-rule bg-bg p-0 text-ink shadow-overlay backdrop:bg-scrim"
    >
      {state.step === "done" ? (
        <div>
          {header(t("done"), "status")}
          <div className="flex flex-col gap-2 p-5">
            <p className="flex items-start gap-2 text-pretty type-small">
              <CheckIcon aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 text-success" />
              {t("doneText")}
            </p>
          </div>
          <div className={footer}>
            <Button variant="quiet" onClick={onClose}>
              {t("close")}
            </Button>
            <ButtonLink href={MY_DOCUMENTS_PATH}>{t("myDocuments")}</ButtonLink>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={submit}>
          {header(t("title"))}
          <div className="flex flex-col gap-4.5 p-5">
            <p className="text-pretty text-ink-2 type-small">{t("intro", { count: documents.length })}</p>
            {/* Titles are text, never HTML (§9). */}
            <ul aria-label={t("documents")} className="border-t border-line">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center gap-2.5 border-b border-line py-2 text-[15px] wrap-anywhere">
                  <LockIcon aria-hidden="true" className="size-4.5 shrink-0 text-ink-2" />
                  {document.title}
                </li>
              ))}
            </ul>
            <fieldset disabled={busy} className="min-w-0">
              <TextArea
                label={t("purpose")}
                hint={t("purposeHint")}
                value={purpose}
                onChange={(event) => {
                  setPurpose(event.target.value);
                  setMissing(false);
                }}
                error={missing ? t("purposeRequired") : undefined}
                maxLength={MAX_LONG_TEXT_LENGTH}
                rows={4}
                required
                autoFocus
              />
            </fieldset>
            {state.step === "form" && state.error && (
              <InlineNotice
                tone="danger"
                title={state.error}
                text={
                  state.profileNeeded ? (
                    <a
                      href={onboardingPath(locale, `/${locale}${requestPath(documents.map((d) => d.id))}`)}
                      className="text-accent underline decoration-1 underline-offset-5 transition-state hover:decoration-2 focus-ring"
                    >
                      {t("finishProfile")}
                    </a>
                  ) : undefined
                }
              />
            )}
          </div>
          <div className={footer}>
            <Button variant="quiet" disabled={busy} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={busy} loadingLabel={t("sending")}>
              {t("submit")}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
