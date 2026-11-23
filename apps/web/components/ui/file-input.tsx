"use client";

import { useLocale } from "next-intl";
import { useId, useState, type DragEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { Label } from "./form-field";
import { metaSeparator } from "@/components/public/home/format";

/**
 * The FileInput board's drop zone. What the field accepts is shown before
 * anything is picked: the types (Latin data, LTR) and the limits, in words.
 * Picking or dropping files hands them to `onFiles`; the caller checks them,
 * uploads them and lists them under the zone as `FileChip` rows (uploading,
 * attached, refused with its reason, failed). Every text comes from the
 * caller's messages.
 */
export function FileInput({
  id: idProp,
  label,
  mark,
  prompt,
  browse,
  dropHere,
  types,
  limits,
  accept,
  multiple = true,
  disabled = false,
  onFiles,
  over: overProp,
  children,
  className,
}: {
  id?: string;
  label: string;
  /** "optional" or "required", from messages. */
  mark?: string;
  /** Before the browse words: "Drag files here, or". */
  prompt: string;
  /** The link-looking words that open the picker: "choose them from your device". */
  browse: string;
  /** Shown while files are dragged over: "Drop the files to attach them". */
  dropHere: string;
  /** "PDF · DOCX · XLSX · JPG · PNG". */
  types: string;
  /** "up to 10 MB a file · 5 files a message", in the page's digits. */
  limits: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Without it the zone only shows itself, as on the design-system page. */
  onFiles?: (files: File[]) => void;
  /** Forces the drag-over look, to show that state on the design-system page. */
  over?: boolean;
  /** The file rows, under the zone. */
  children?: ReactNode;
  className?: string;
}) {
  const locale = useLocale();
  const generated = useId();
  const id = idProp ?? generated;
  const limitsId = `${id}-limits`;
  const [dragging, setOver] = useState(false);
  const over = overProp ?? dragging;

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles?.(multiple ? files : files.slice(0, 1));
  }

  return (
    <div className={cx("flex min-w-0 flex-col gap-2.5", className)}>
      <Label htmlFor={id} mark={mark}>
        {label}
      </Label>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        data-over={over || undefined}
        className={cx(
          "relative flex flex-col items-center gap-1.5 border-[1.5px] border-dashed px-5 py-7 text-center transition-state",
          "has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-focus has-focus-visible:outline-solid",
          over ? "border-accent bg-accent-wash" : "border-line-strong bg-bg",
          disabled ? "cursor-not-allowed bg-surface text-ink-2" : "cursor-pointer",
        )}
      >
        {over ? (
          <span className="type-small">{dropHere}</span>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="square"
              aria-hidden="true"
            >
              <path d="M12 15V4M7 9l5-5 5 5M5 20h14" />
            </svg>
            <span className="type-small">
              {prompt}{" "}
              <span className="text-accent underline decoration-1 underline-offset-5">{browse}</span>
            </span>
          </>
        )}
        <span id={limitsId} className="text-[13px] leading-[1.7] text-ink-2">
          <span dir="ltr" className="font-mono">
            {types}
          </span>
          {metaSeparator(locale)}
          {limits}
        </span>
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-describedby={limitsId}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) onFiles?.(files);
            // Lets the same file be picked again after it's removed.
            event.target.value = "";
          }}
        />
      </label>
      {children}
    </div>
  );
}
