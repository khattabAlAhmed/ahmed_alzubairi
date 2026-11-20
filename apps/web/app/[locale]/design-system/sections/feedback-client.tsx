"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/feedback/dialog";
import { CloseIcon } from "@/components/icons";
import { Button, TextField } from "@/components/ui";
import { ConfirmTwice } from "@/components/workspace/confirm-twice";

/*
 * Demo-only client parts for the feedback section of the design-system page:
 * open/close state for the dialogs, and buttons with no-op handlers. No API
 * calls, and nothing in the app imports this file.
 */

const noop = () => {};

/** A button that does nothing, for retry and resend samples. */
export function DemoButton({ label, variant = "secondary", size = "sm" }: { label: string; variant?: "primary" | "secondary" | "quiet"; size?: "sm" | "md" }) {
  return (
    <Button variant={variant} size={size} onClick={noop}>
      {label}
    </Button>
  );
}

/** The notice's close button: an icon with an aria-label. */
export function DemoCloseButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={noop}
      className="inline-flex size-8 items-center justify-center text-ink-2 transition-state hover:bg-surface-hover hover:text-ink focus-ring"
    >
      <CloseIcon className="size-3.5" />
    </button>
  );
}

type DialogText = {
  open: string;
  title: string;
  text: string;
  cancel: string;
  confirm: string;
};

/** The default dialog: a question and two buttons. */
export function DemoDialog({ text }: { text: DialogText }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {text.open}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={text.title}
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              {text.cancel}
            </Button>
            <Button onClick={() => setOpen(false)}>{text.confirm}</Button>
          </>
        }
      >
        <p>{text.text}</p>
      </Dialog>
    </>
  );
}

/** A dialog with a form: Enter submits. */
export function DemoFormDialog({ text, field, hint }: { text: DialogText; field: string; hint: string }) {
  const [open, setOpen] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpen(false);
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {text.open}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={text.title}
        onSubmit={submit}
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              {text.cancel}
            </Button>
            <Button type="submit">{text.confirm}</Button>
          </>
        }
      >
        <p>{text.text}</p>
        <TextField label={field} hint={hint} name="ds-suggested-time" autoFocus />
      </Dialog>
    </>
  );
}

/** The destructive confirmation: ConfirmTwice, with the typed word. */
export function DemoConfirmTwice({
  open: openLabel,
  title,
  question,
  word,
  confirm,
}: {
  open: string;
  title: string;
  question: string;
  word: string;
  confirm: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <ConfirmTwice
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        title={title}
        question={question}
        word={word}
        confirmLabel={confirm}
      />
    </>
  );
}
