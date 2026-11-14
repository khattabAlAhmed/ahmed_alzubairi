"use client";

import { MAX_LONG_TEXT_LENGTH } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink, TextArea } from "@/components/ui";
import { onboardingPath } from "@/lib/auth/return-path";
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

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(34rem,calc(100%-2rem))] rounded-lg border border-text/15 bg-surface p-0 text-text shadow-lg backdrop:bg-primary/70 backdrop:backdrop-blur-[2px]"
    >
      {state.step === "done" ? (
        <div className="space-y-4 p-6">
          <h2 id={titleId} role="status" className="text-xl text-balance">
            {t("done")}
          </h2>
          <p className="max-w-prose text-pretty text-text-secondary">{t("doneText")}</p>
          <div className="flex flex-wrap-reverse justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("close")}
            </Button>
            <ButtonLink href={MY_DOCUMENTS_PATH}>{t("myDocuments")}</ButtonLink>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-4 p-6">
          <h2 id={titleId} className="text-xl text-balance">
            {t("title")}
          </h2>
          <p className="max-w-prose text-pretty text-text-secondary">
            {t("intro", { count: documents.length })}
          </p>
          <div>
            <p className="text-sm font-semibold">{t("documents")}</p>
            {/* Titles are text, never HTML (§9). */}
            <ul className="mt-1 list-disc space-y-1 ps-5">
              {documents.map((document) => (
                <li key={document.id} className="wrap-anywhere">
                  {document.title}
                </li>
              ))}
            </ul>
          </div>
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
            <div role="alert" className="space-y-2 text-sm font-semibold text-danger">
              <p>{state.error}</p>
              {state.profileNeeded && (
                <a
                  href={onboardingPath(locale, `/${locale}${requestPath(documents.map((d) => d.id))}`)}
                  className="text-text underline"
                >
                  {t("finishProfile")}
                </a>
              )}
            </div>
          )}
          <div className="flex flex-wrap-reverse justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClose}>
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
