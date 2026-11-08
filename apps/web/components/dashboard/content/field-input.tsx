"use client";

import { Checkbox, Select, TextArea, TextField } from "@/components/ui";
import type { ImageValue } from "./form-values";
import {
  useFieldText,
  type FieldRenderer,
  type Key,
  type FieldRendererProps,
} from "./field-text";
import { OPTION_SETS, type FieldKind } from "./registry";
import { ImagesInput, UploadInput } from "./upload-input";

function TextInput({ field, name, ctx }: FieldRendererProps) {
  const text = useFieldText();
  const value = String(ctx.values[name] ?? "");
  const common = {
    name,
    label: text.label(field) + text.required(ctx, field, name),
    hint: text.hint(field),
    error: text.error(ctx, name),
    value,
  };
  if (field.kind === "longtext") {
    return (
      <TextArea
        {...common}
        onChange={(event) => ctx.setValue(name, event.target.value)}
      />
    );
  }
  const type =
    field.kind === "url"
      ? "url"
      : field.kind === "date"
        ? "date"
        : field.kind === "number"
          ? "number"
          : "text";
  return (
    <TextField
      {...common}
      type={type}
      dir={field.kind === "slug" || field.kind === "url" ? "ltr" : undefined}
      inputMode={field.kind === "number" ? "numeric" : undefined}
      min={field.kind === "number" ? 0 : undefined}
      onChange={(event) => ctx.setValue(name, event.target.value)}
    />
  );
}

function BooleanInput({ field, name, ctx }: FieldRendererProps) {
  const text = useFieldText();
  return (
    <Checkbox
      name={name}
      label={text.label(field)}
      hint={text.hint(field)}
      error={text.error(ctx, name)}
      checked={ctx.values[name] === true}
      onChange={(event) => ctx.setValue(name, event.target.checked)}
    />
  );
}

function SelectInput({ field, name, ctx }: FieldRendererProps) {
  const text = useFieldText();
  const options =
    field.kind === "select"
      ? (OPTION_SETS[field.options] as readonly string[]).map((value) => ({
          id: value,
          title: text.t(`options.${field.options}.${value}` as Key),
        }))
      : field.kind === "reference"
        ? (ctx.refOptions[field.refType] ?? [])
        : [];
  return (
    <Select
      name={name}
      label={text.label(field) + text.required(ctx, field, name)}
      hint={text.hint(field)}
      error={text.error(ctx, name)}
      value={String(ctx.values[name] ?? "")}
      onChange={(event) => ctx.setValue(name, event.target.value)}
    >
      <option value="">{text.t("editor.none")}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.title}
        </option>
      ))}
    </Select>
  );
}

function ReferencesInput({ field, name, ctx }: FieldRendererProps) {
  const text = useFieldText();
  if (field.kind !== "references") return null;
  const selected = new Set(
    Array.isArray(ctx.values[name]) ? (ctx.values[name] as string[]) : [],
  );
  const options = ctx.refOptions[field.refType] ?? [];
  const error = text.error(ctx, name);
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{text.label(field)}</legend>
      {options.length === 0 ? (
        <p className="mt-1 text-sm text-text-secondary">
          {text.t("editor.none")}
        </p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <Checkbox
              key={option.id}
              label={option.title}
              checked={selected.has(option.id)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.id);
                else next.delete(option.id);
                ctx.setValue(name, [...next]);
              }}
            />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function UploadRenderer({ field, name, ctx }: FieldRendererProps) {
  if (field.kind === "images") {
    return (
      <ImagesInput
        field={field}
        name={name}
        ctx={ctx}
        images={(ctx.values[name] as ImageValue[] | undefined) ?? []}
      />
    );
  }
  return <UploadInput field={field} name={name} ctx={ctx} />;
}

/**
 * One renderer per field kind. P2P-T13 adds `richtext` here; until then it
 * falls back to `LaterField`.
 */
export const FIELD_RENDERERS: Partial<Record<FieldKind, FieldRenderer>> = {
  text: TextInput,
  longtext: TextInput,
  slug: TextInput,
  url: TextInput,
  date: TextInput,
  number: TextInput,
  boolean: BooleanInput,
  select: SelectInput,
  reference: SelectInput,
  references: ReferencesInput,
  image: UploadRenderer,
  file: UploadRenderer,
  images: UploadRenderer,
};

/** A field whose kind has no renderer yet. Its saved value is sent back unchanged. */
function LaterField({ field }: FieldRendererProps) {
  const text = useFieldText();
  return (
    <div>
      <p className="text-sm font-semibold">{text.label(field)}</p>
      <p className="mt-1 text-sm text-text-secondary">{text.t("editor.laterField")}</p>
    </div>
  );
}

export function FieldInput(props: FieldRendererProps) {
  const Renderer = FIELD_RENDERERS[props.field.kind] ?? LaterField;
  return <Renderer {...props} />;
}
