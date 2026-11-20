"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/feedback/dialog";
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
 * The double confirmation for deletes (§6.17 retention, the Dialog board):
 * first a question, then a word to type. The final button stays disabled
 * until the word matches. Built on Dialog: a native modal, so focus stays
 * inside, Escape cancels, and focus goes back to the opener.
 */
export function ConfirmTwice(props: ConfirmTwiceProps) {
  // Mounted only while open, so each opening starts at step one with an empty field.
  if (!props.open) return null;
  return <ConfirmDialog {...props} />;
}

function ConfirmDialog({ onCancel, onConfirm, title, question, word, confirmLabel, busy = false, error }: ConfirmTwiceProps) {
  const t = useTranslations("Workspace.confirm");
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const matches = wordMatches(typed, word);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    if (matches && !busy) onConfirm();
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      busy={busy}
      tone="danger"
      title={title}
      step={t("step", { step })}
      onSubmit={submit}
      footer={
        <>
          <Button variant="quiet" disabled={busy} onClick={onCancel}>
            {t("cancel")}
          </Button>
          {step === 1 ? (
            <Button type="submit" variant="danger" data-autofocus>
              {t("continue")}
            </Button>
          ) : (
            <Button type="submit" variant="danger" disabled={!matches} loading={busy} loadingLabel={confirmLabel}>
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      <p className="max-w-prose">{question}</p>
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
    </Dialog>
  );
}
