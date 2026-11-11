"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";
import { ChevronDownIcon } from "./icons";
import { usePanelLanguage } from "./language-tabs";

// The border is 50% text so the field's edge passes 3:1 against the surface.
// `unicode-bidi: plaintext` lays each line out from its own text, so an email
// typed on an Arabic page keeps its start. The caret still starts on the page side.
const CONTROL = cx(
  "block w-full rounded-md border border-text/50 bg-surface text-text placeholder:text-text-secondary",
  "focus:outline-2 focus:outline-offset-1 focus:outline-ring",
  "aria-invalid:border-danger aria-invalid:border-2",
  "disabled:cursor-not-allowed disabled:bg-text/5 disabled:opacity-60",
);
const TEXT_CONTROL = cx(CONTROL, "px-3 text-start [unicode-bidi:plaintext]");

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cx("block text-sm font-semibold text-text", className)}>
      {children}
    </label>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 text-sm text-text-secondary">
      {children}
    </p>
  );
}

/** `role="alert"`, so a screen reader reads the error as soon as it appears. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-semibold text-danger">
      {children}
    </p>
  );
}

type FieldText = {
  label: string;
  /** Help shown under the field, read with it by screen readers. */
  hint?: string;
  /** Marks the field invalid and is read with it. */
  error?: string;
};

/**
 * Ties the label, hint and error to the control.
 *
 * Inside a `LanguageTabs` panel, `content` gives a control that holds content
 * the panel's language and direction, unless the field sets its own (a slug
 * or a URL is always `ltr`). The label, hint and error are UI text and take
 * nothing, so they stay in the UI's. Outside a panel `content` is empty.
 */
function useField(idProp: string | undefined, { hint, error }: FieldText) {
  const generated = useId();
  const panel = usePanelLanguage();
  const id = idProp ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return {
    id,
    controlProps: {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy,
    },
    content: (own: { lang?: string; dir?: string }) => ({
      lang: own.lang ?? panel?.lang,
      dir: own.dir ?? panel?.dir,
    }),
    after: (
      <>
        {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </>
    ),
  };
}

type TextFieldProps = FieldText & Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "text" | "email" | "tel" | "url" | "password" | "search" | "number" | "date";
};

export function TextField({ label, hint, error, id: idProp, className, type = "text", lang, dir, ...props }: TextFieldProps) {
  const field = useField(idProp, { label, hint, error });

  return (
    <div className={className}>
      <Label htmlFor={field.id}>{label}</Label>
      <input
        type={type}
        className={cx(TEXT_CONTROL, "mt-1 h-11")}
        {...field.controlProps}
        {...field.content({ lang, dir })}
        {...props}
      />
      {field.after}
    </div>
  );
}

type TextAreaProps = FieldText & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ label, hint, error, id: idProp, className, rows = 5, lang, dir, ...props }: TextAreaProps) {
  const field = useField(idProp, { label, hint, error });

  return (
    <div className={className}>
      <Label htmlFor={field.id}>{label}</Label>
      <textarea
        rows={rows}
        className={cx(TEXT_CONTROL, "mt-1 min-h-24 py-2 leading-relaxed")}
        {...field.controlProps}
        {...field.content({ lang, dir })}
        {...props}
      />
      {field.after}
    </div>
  );
}

type SelectProps = FieldText & SelectHTMLAttributes<HTMLSelectElement> & {
  /** `<option>` elements. */
  children: ReactNode;
};

export function Select({ label, hint, error, id: idProp, className, children, ...props }: SelectProps) {
  const field = useField(idProp, { label, hint, error });

  return (
    <div className={className}>
      <Label htmlFor={field.id}>{label}</Label>
      <div className="relative mt-1">
        <select className={cx(CONTROL, "h-11 appearance-none ps-3 pe-10")} {...field.controlProps} {...props}>
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-secondary" />
      </div>
      {field.after}
    </div>
  );
}

type CheckboxProps = Omit<FieldText, "label"> & Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Can hold a link, such as "I accept the terms". */
  label: ReactNode;
};

export function Checkbox({ label, hint, error, id: idProp, className, lang, dir, ...props }: CheckboxProps) {
  const field = useField(idProp, { label: "", hint, error });

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className={cx(
            "mt-0.5 size-5 shrink-0 cursor-pointer accent-text",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "aria-invalid:outline-2 aria-invalid:outline-offset-1 aria-invalid:outline-danger",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          {...field.controlProps}
          {...field.content({ lang, dir })}
          {...props}
        />
        <label htmlFor={field.id} className="text-sm text-text">
          {label}
        </label>
      </div>
      <div className="ps-8">{field.after}</div>
    </div>
  );
}
