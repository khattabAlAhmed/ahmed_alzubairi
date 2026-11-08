"use client";

import type { Locale } from "@repo/shared";
import { useEffect } from "react";
import { LanguageTabs } from "@/components/ui";
import { EditorActions, PublishPanel, useContentEditor } from "../content/content-editor";
import { FieldInput } from "../content/field-input";
import { useFieldText } from "../content/field-text";
import { inputNames, type Row } from "../content/form-values";
import { CONTENT_CONFIG } from "../content/registry";

const FIELDS = CONTENT_CONFIG.home_stats.fields;
const LABEL = FIELDS.find((field) => field.name === "label")!;
const VALUE = FIELDS.find((field) => field.name === "value")!;

/**
 * One quick stat's form: its label in both languages, its number, and the
 * shared publish panel. It saves through the content API like every content
 * editor. The position is set by the list's reorder, never typed.
 */
export function StatEditor({
  row,
  newPosition,
  mediaBase,
  justCreated = false,
}: {
  /** The stat, or null for a new one. */
  row: Row | null;
  /** For a new stat: where it goes, after the last one. */
  newPosition?: number;
  mediaBase: string;
  justCreated?: boolean;
}) {
  const text = useFieldText();
  const editor = useContentEditor({
    type: "home_stats",
    row,
    refOptions: {},
    mediaBase,
    justCreated,
  });
  const { ctx, errors } = editor;
  const { setValue } = ctx;

  useEffect(() => {
    if (row === null && newPosition !== undefined) setValue("position", String(newPosition));
    // Once, for a new stat: a reorder never changes an open form's position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panel = (locale: Locale, index: number) => {
    const name = inputNames(LABEL)[index];
    return {
      label: text.t(`locales.${locale}`),
      invalid: name in errors,
      content: <FieldInput field={LABEL} name={name} ctx={ctx} />,
    };
  };

  return (
    <form noValidate onSubmit={(event) => void editor.save(event)} className="mt-4 space-y-6">
      <LanguageTabs
        label={text.t("editor.languageTabs")}
        invalidLabel={text.t("editor.invalidTab")}
        arabic={panel("ar", 0)}
        english={panel("en", 1)}
      />
      <FieldInput field={VALUE} name="value" ctx={ctx} />
      <PublishPanel editor={editor} />
      <EditorActions editor={editor} />
    </form>
  );
}
