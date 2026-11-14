"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui";

export type ConfirmTwiceProps = {
  open: boolean;
  /** Closes without acting: Cancel, Esc, or the parent. */
  onCancel: () => void;
  /** Called only after both steps. */
  onConfirm: () => void;
  title: string;
  /** Step one: what will happen, such as "Delete this chat and its 4 files? This can't be undone." */
  question: string;
  /** Step two: the word to type, such as "حذف" or "DELETE". */
  word: string;
  /** The final button, such as "Delete for good". */
  confirmLabel: string;
  busy?: boolean;
  /** Shown on step two if the action failed. */
  error?: string;
};

/** True when the typed text is the word: spaces around it and Unicode forms don't matter, case does. */
export function wordMatches(typed: string, word: string): boolean {
  return typed.trim().normalize("NFC") === word.trim().normalize("NFC");
}

/**
 * The double confirmation for deletes (§6.17 retention): first a question,
 * then a word to type. The final button stays disabled until the word
 * matches. A native modal `<dialog>`, so focus stays inside and Esc cancels.
 */
export function ConfirmTwice(props: ConfirmTwiceProps) {
  // Mounted only while open, so each opening starts at step one with an empty field.
  if (!props.open) return null;
  return <ConfirmDialog {...props} />;
}

function ConfirmDialog({ onCancel, onConfirm, title, question, word, confirmLabel, busy = false, error }: ConfirmTwiceProps) {
  const t = useTranslations("Workspace.confirm");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const matches = wordMatches(typed, word);

  useEffect(() => {
    const element = dialog.current;
    // Focus goes back to whatever opened the dialog.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) {
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    }
    return () => {
      if (element?.open && typeof element.close === "function") element.close();
      opener?.focus();
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    if (matches && !busy) onConfirm();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Esc: the browser's cancel. The parent decides, so the dialog only closes through `open`.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-text/15 bg-surface p-0 text-text shadow-lg backdrop:bg-primary/70 backdrop:backdrop-blur-[2px]"
    >
      <form noValidate onSubmit={submit} className="space-y-4 p-6">
        <div>
          <p className="text-xs font-semibold text-text-secondary">{t("step", { step })}</p>
          <h2 id={titleId} className="mt-1 text-xl text-balance">
            {title}
          </h2>
        </div>
        <p className="max-w-prose text-pretty">{question}</p>
        {step === 2 && (
          <TextField
            label={t("typeWord", { word })}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            // A wrong word is shown only once something is typed.
            error={typed.trim() !== "" && !matches ? t("mismatch") : error}
            autoFocus
          />
        )}
        <div className="flex flex-wrap-reverse justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {t("cancel")}
          </Button>
          {step === 1 ? (
            <Button type="submit" autoFocus>
              {t("continue")}
            </Button>
          ) : (
            <Button type="submit" disabled={!matches} loading={busy} loadingLabel={confirmLabel}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
