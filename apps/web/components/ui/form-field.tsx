"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";
import { CheckIcon, ChevronDownIcon, CloseIcon } from "../icons";
import { usePanelLanguage } from "./language-tabs";

/*
 * The TextField and Choice boards. A field is a hairline box on the page
 * ground with a 2px ink-2 underline: the underline turns accent on focus and
 * danger on an error, and the one focus ring sits 2px outside. Square corners.
 *
 * `unicode-bidi: plaintext` lays each line out from its own text, so English
 * typed on an Arabic page keeps its start. Email, phone and URL fields are
 * data: they read LTR in Western digits and the mono face, whatever the page
 * language (`.r-input--ltr`).
 */
const CONTROL = cx(
  "block w-full border border-line-strong border-b-2 border-b-ink-2 bg-bg text-base leading-[1.6] text-ink placeholder:text-ink-2",
  "transition-state focus:border-b-accent focus:outline-2 focus:outline-offset-2 focus:outline-focus focus:outline-solid",
  "aria-invalid:border-b-danger",
  "disabled:cursor-not-allowed disabled:border-b-line-strong disabled:bg-surface disabled:text-ink-2",
);
const TEXT_CONTROL = cx(CONTROL, "px-3.5 py-2.5 text-start [unicode-bidi:plaintext]");
// With `dir="ltr"`, `text-start` (from TEXT_CONTROL) is the left edge.
const LTR_CONTROL = "font-mono text-[15px] [unicode-bidi:normal]";
const LTR_TYPES = new Set(["email", "tel", "url"]);

export function Label({
  htmlFor,
  children,
  mark,
  className,
}: {
  htmlFor: string;
  children: ReactNode;
  /** A word after the label, such as "optional" or "required", from messages. */
  mark?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cx("block text-[15px] leading-[1.6] font-medium text-ink", className)}>
      {children}
      {mark && <span className="ms-1.5 text-[13px] font-normal text-ink-2">{mark}</span>}
    </label>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-[13px] leading-[1.7] text-ink-2">
      {children}
    </p>
  );
}

/** `role="alert"`, so a screen reader reads the error as soon as it appears. Glyph plus words, never color alone. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[13px] leading-[1.7] text-danger">
      <CloseIcon aria-hidden="true" className="mt-1 size-3.5 shrink-0" strokeWidth={2.4} />
      <span>{children}</span>
    </p>
  );
}

type FieldText = {
  label: string;
  /** A word after the label: "optional" on optional fields, or "required". From messages. */
  mark?: string;
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

export function TextField({
  label,
  mark,
  hint,
  error,
  id: idProp,
  className,
  type = "text",
  lang,
  dir,
  ...props
}: TextFieldProps) {
  const field = useField(idProp, { label, hint, error });
  const ltr = LTR_TYPES.has(type);

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={field.id} mark={mark}>
        {label}
      </Label>
      <input
        type={type}
        className={cx(TEXT_CONTROL, "min-h-12", ltr && LTR_CONTROL)}
        {...field.controlProps}
        {...field.content({ lang, dir: dir ?? (ltr ? "ltr" : undefined) })}
        {...props}
      />
      {field.after}
    </div>
  );
}

type TextAreaProps = FieldText & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextArea({ label, mark, hint, error, id: idProp, className, rows = 5, lang, dir, ...props }: TextAreaProps) {
  const field = useField(idProp, { label, hint, error });

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={field.id} mark={mark}>
        {label}
      </Label>
      <textarea
        rows={rows}
        className={cx(TEXT_CONTROL, "min-h-32 resize-y")}
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

export function Select({ label, mark, hint, error, id: idProp, className, children, ...props }: SelectProps) {
  const field = useField(idProp, { label, hint, error });

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={field.id} mark={mark}>
        {label}
      </Label>
      <div className="relative">
        <select className={cx(CONTROL, "min-h-12 cursor-pointer appearance-none ps-3.5 pe-10")} {...field.controlProps} {...props}>
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-2" />
      </div>
      {field.after}
    </div>
  );
}

type CheckboxProps = Omit<FieldText, "label" | "mark"> & Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Can hold a link, such as the consent line "I agree to the terms of use". */
  label: ReactNode;
};

// A square box: line-strong edge, accent fill when checked, the check drawn on top.
const BOX = cx(
  "peer absolute inset-0 m-0 cursor-pointer appearance-none border-[1.5px] border-line-strong bg-bg transition-state",
  "checked:border-accent checked:bg-accent",
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus focus-visible:outline-solid",
  "aria-invalid:border-danger",
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface",
);

/** A checkbox, or the consent checkbox when its label holds links. */
export function Checkbox({ label, hint, error, id: idProp, className, lang, dir, ...props }: CheckboxProps) {
  const field = useField(idProp, { label: "", hint, error });

  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-3">
        <span className="relative mt-1 size-5 shrink-0">
          <input type="checkbox" className={BOX} {...field.controlProps} {...field.content({ lang, dir })} {...props} />
          <CheckIcon
            aria-hidden="true"
            strokeWidth={2}
            className="pointer-events-none absolute inset-0.5 hidden size-4 text-on-accent peer-checked:block"
          />
        </span>
        <label htmlFor={field.id} className="cursor-pointer text-[15px] leading-[1.75] text-ink">
          {label}
        </label>
      </div>
      <div className="flex flex-col gap-1 ps-8">{field.after}</div>
    </div>
  );
}

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode };

/** One choice of a group. Put the group in a `<fieldset>` with a `<legend>`. Round: a true circle. */
export function Radio({ label, id: idProp, className, ...props }: RadioProps) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <input
        id={id}
        type="radio"
        className={cx(
          "mt-1 size-5 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-line-strong bg-bg transition-state",
          "checked:border-[6px] checked:border-accent",
          "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus focus-visible:outline-solid",
          "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface",
        )}
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-[15px] leading-[1.75] text-ink">
        {label}
      </label>
    </div>
  );
}

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & { label: ReactNode; hint?: string };

/**
 * An on/off setting that applies at once, label first and the switch at the
 * end. Square, like every control; the knob moves to the end side in both
 * directions.
 */
export function Switch({ label, hint, id: idProp, className, ...props }: SwitchProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[15px] leading-[1.75] text-ink">
          {label}
        </label>
        {hint && hintId && <FieldHint id={hintId}>{hint}</FieldHint>}
      </div>
      {/* The knob is a sibling span, not ::after: pseudo-elements on inputs aren't drawn everywhere. */}
      <span className="relative mt-1 h-6 w-11 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-describedby={hintId}
          className={cx(
            "peer absolute inset-0 m-0 cursor-pointer appearance-none border-[1.5px] border-line-strong bg-surface transition-state",
            "checked:border-accent checked:bg-accent",
            "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus focus-visible:outline-solid",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-[4.5px] start-[4.5px] w-[15px] bg-line-strong transition-[inset-inline-start] duration-200 peer-checked:start-[24.5px] peer-checked:bg-on-accent"
        />
      </span>
    </div>
  );
}

/**
 * The switch's look for a `<button role="switch" aria-checked>`, such as the
 * account's notify switch. A button draws its ::after knob everywhere.
 */
export const SWITCH_TRACK = cx(
  "relative h-6 w-11 shrink-0 cursor-pointer border-[1.5px] border-line-strong bg-surface transition-state",
  "after:absolute after:inset-y-[3px] after:start-[3px] after:w-[15px] after:bg-line-strong after:transition-[inset-inline-start] after:duration-200 after:content-['']",
  "aria-checked:border-accent aria-checked:bg-accent aria-checked:after:start-[23px] aria-checked:after:bg-on-accent",
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus focus-visible:outline-solid",
  "disabled:cursor-not-allowed disabled:opacity-60",
);
