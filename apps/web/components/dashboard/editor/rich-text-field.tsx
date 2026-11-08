"use client";

import type { Locale, TiptapDoc } from "@repo/shared";
import { useFieldText, type FieldRendererProps } from "../content/field-text";
import { RichTextEditor } from "../rich-text/rich-text-editor";

/**
 * The `richtext` field kind for P2P-T12's generic editor: one Tiptap editor
 * per language input (`bodyAr`, `bodyEn`). It stores Tiptap JSON only.
 */
export function RichTextField({ field, name, ctx }: FieldRendererProps) {
  const text = useFieldText();
  const lang: Locale = name.endsWith("En") ? "en" : "ar";
  const value = ctx.values[name];

  return (
    <RichTextEditor
      lang={lang}
      value={isDoc(value) ? value : null}
      onChange={(doc) => ctx.setValue(name, doc)}
      label={text.label(field) + text.required(ctx, field, name)}
      hint={text.hint(field)}
      error={text.error(ctx, name)}
    />
  );
}

function isDoc(value: unknown): value is TiptapDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "doc"
  );
}
