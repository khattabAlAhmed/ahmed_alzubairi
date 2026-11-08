"use client";

import type { ContentType } from "@repo/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { FieldErrors, Row } from "./form-values";
import type { FieldDef } from "./registry";

/** A row another field can point at, by id, with its name in the page language. */
export type RefOption = { id: string; title: string };

/** What every field renderer gets from the editor. */
export type FieldContext = {
  type: ContentType;
  values: Row;
  original: Row | null;
  errors: FieldErrors;
  setValue: (name: string, value: unknown) => void;
  refOptions: Partial<Record<ContentType, RefOption[]>>;
  /** The public URL prefix of `public-media`, for image previews. */
  mediaBase: string;
  /** Input names a language needs to be available (`REQUIRED_FIELDS`). */
  requiredNames: ReadonlySet<string>;
};

export type FieldRendererProps = {
  field: FieldDef;
  /** The input's body name, such as `titleAr`. */
  name: string;
  ctx: FieldContext;
};

export type FieldRenderer = (props: FieldRendererProps) => ReactNode;

type T = ReturnType<typeof useTranslations<"DashboardContent">>;
export type Key = Parameters<T>[0];

/**
 * Wraps UI text in Unicode isolates (FSI … PDI). Field labels are in the page
 * language, but the Arabic panel is always RTL and the English one LTR: the
 * isolate keeps each label in its own direction, so its punctuation doesn't
 * flip.
 */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`;
}

/** Messages keyed by registry names; `registry.test.ts` checks each exists. */
export function useFieldText() {
  const t = useTranslations("DashboardContent");
  const required = (ctx: FieldContext, field: FieldDef, name: string) =>
    field.required || ctx.requiredNames.has(name)
      ? ` ${t("editor.requiredMark")}`
      : "";
  return {
    t,
    isolate,
    label: (field: FieldDef) => isolate(t(`fields.${field.name}` as Key)),
    /** The label plus "(required)" when the field needs a value, as one isolate. */
    requiredLabel: (ctx: FieldContext, field: FieldDef, name: string) =>
      isolate(t(`fields.${field.name}` as Key) + required(ctx, field, name)),
    hint: (field: FieldDef) =>
      t.has(`fields.${field.name}Hint` as Key)
        ? isolate(t(`fields.${field.name}Hint` as Key))
        : undefined,
    error: (ctx: FieldContext, name: string) => {
      const problem = ctx.errors[name];
      return problem ? isolate(t(`editor.${problem}`)) : undefined;
    },
  };
}
