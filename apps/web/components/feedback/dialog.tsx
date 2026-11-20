"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type DialogProps = {
  open: boolean;
  /** Closes without acting: Escape, a cancel button, or the parent. */
  onClose: () => void;
  title: string;
  /** What the dialog says or asks. */
  children: ReactNode;
  /** The buttons, cancel first. They sit at the end, under a hairline. */
  footer: ReactNode;
  /**
   * `danger` for a destructive confirmation: a danger opening rule and the
   * `alertdialog` role, so it's read out at once.
   */
  tone?: "default" | "danger";
  /** A short line above the title, such as "Step 2 of 2". */
  step?: string;
  /** With it, the body and footer are a form: Enter submits, and a `type="submit"` button in the footer submits. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** While true, Escape does nothing, so a running action isn't left behind. */
  busy?: boolean;
  className?: string;
};

/**
 * The Dialog board: the one way to interrupt a page. A native modal
 * `<dialog>` (`showModal`), so the page behind it is inert and focus stays
 * inside; Escape closes it; focus goes back to whatever opened it. It sits on
 * the `scrim` and is the one thing on a page with a shadow (`shadow-overlay`),
 * opened by the heavy rule like everything else in the record.
 *
 * Mounted only while open, so each opening starts fresh. To choose the
 * control that gets focus first, mark it `data-autofocus` (not `autoFocus`).
 */
export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return <OpenDialog {...props} />;
}

function OpenDialog({ onClose, title, children, footer, tone = "default", step, onSubmit, busy = false, className }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Read on the first render, before anything inside takes focus, so focus
  // goes back to whatever really opened the dialog.
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
      // React's `autoFocus` can't work here: the dialog isn't open when React
      // focuses, and showModal() then picks the first control (often Cancel).
      // A control marked `data-autofocus` gets focus instead.
      element.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    const returnTo = opener.current instanceof HTMLElement ? opener.current : null;
    return () => {
      if (element?.open && typeof element.close === "function") element.close();
      returnTo?.focus();
    };
  }, []);

  const body = (
    <>
      <div className="flex flex-col gap-3 p-5">
        {step && <p className="font-mono text-[11px] text-ink-2">{step}</p>}
        <h2 id={titleId} className="type-h3">
          {title}
        </h2>
        <div className="flex flex-col gap-3 text-pretty type-small">{children}</div>
      </div>
      <div className="flex flex-wrap-reverse justify-end gap-2.5 border-t border-line px-5 py-3.5">{footer}</div>
    </>
  );

  return (
    <dialog
      ref={dialog}
      role={tone === "danger" ? "alertdialog" : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      // Escape is the browser's cancel. The parent decides, so the dialog only closes through `open`.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className={cx(
        "m-auto w-[min(32rem,calc(100%-2rem))] border-0 border-t-2 bg-bg p-0 text-ink shadow-overlay backdrop:bg-scrim",
        tone === "danger" ? "border-danger" : "border-rule",
        className,
      )}
    >
      {onSubmit ? (
        <form noValidate onSubmit={onSubmit}>
          {body}
        </form>
      ) : (
        body
      )}
    </dialog>
  );
}
