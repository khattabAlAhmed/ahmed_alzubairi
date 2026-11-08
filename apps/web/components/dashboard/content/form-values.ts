import {
  availableLocales,
  contentCreateBodySchemas,
  contentUpdateBodySchemas,
  localizedField,
  LOCALES,
  publishProblems,
  REQUIRED_FIELDS,
  type ContentStatus,
  type ContentType,
  type Locale,
  type PublishProblem,
} from "@repo/shared";
import { CONTENT_CONFIG, type FieldDef } from "./registry";

/** A dashboard row or a form's values, camelCase as in `packages/shared`. */
export type Row = Record<string, unknown>;

/** One image of a project, as the form holds it. */
export type ImageValue = { key: string; altAr: string; altEn: string };

/**
 * Why a field can't be saved:
 * - `required`: a create needs it.
 * - `invalid`: the shared schema refused the value.
 * - `cantClear`: it had a value, and the content API can't empty a field.
 */
export type FieldProblem = "required" | "invalid" | "cantClear";

export type FieldErrors = Record<string, FieldProblem>;

/** The input names of a field: `title` → `titleAr`, `titleEn`. */
export function inputNames(field: FieldDef): string[] {
  return "localized" in field && field.localized
    ? LOCALES.map((locale) => localizedField(field.name, locale))
    : [field.name];
}

function filled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/** The form's starting values: a row to edit, or an empty one. */
export function rowToValues(type: ContentType, row: Row | null): Row {
  const values: Row = { status: row?.status ?? "draft" };
  for (const field of CONTENT_CONFIG[type].fields) {
    for (const name of inputNames(field)) {
      const value = row?.[name];
      switch (field.kind) {
        case "boolean":
          values[name] = value === true;
          break;
        case "number":
          values[name] = typeof value === "number" ? String(value) : "";
          break;
        case "references":
          values[name] = Array.isArray(value) ? [...value] : [];
          break;
        case "images":
          values[name] = Array.isArray(value)
            ? (value as Row[]).map((image) => ({
                key: String(image.key),
                altAr: typeof image.altAr === "string" ? image.altAr : "",
                altEn: typeof image.altEn === "string" ? image.altEn : "",
              }))
            : [];
          break;
        case "richtext":
          values[name] = value ?? null;
          break;
        default:
          values[name] = typeof value === "string" ? value : "";
      }
    }
  }
  return values;
}

function imageBody(images: ImageValue[]): Row[] {
  return images.map((image, index) => {
    const body: Row = { key: image.key, position: index };
    if (image.altAr.trim()) body.altAr = image.altAr.trim();
    if (image.altEn.trim()) body.altEn = image.altEn.trim();
    return body;
  });
}

/** One input's value as the API takes it, or undefined to leave it out. */
function bodyValue(field: FieldDef, value: unknown): unknown {
  switch (field.kind) {
    case "boolean":
      return value === true;
    case "references":
      return Array.isArray(value) ? value : [];
    case "images":
      return imageBody(Array.isArray(value) ? (value as ImageValue[]) : []);
    case "richtext":
      return value ?? undefined;
    case "number": {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const number = Number(value);
      // A value the schema refuses, so the field shows its error.
      return Number.isFinite(number) ? number : value;
    }
    default:
      return typeof value === "string" && value.trim() !== ""
        ? value.trim()
        : undefined;
  }
}

export type BuiltBody = { body: Row; errors: FieldErrors; formError: boolean };

/**
 * The request body for a create or an update, checked against the same shared
 * schema the route uses. An update sends every filled field; the API keeps
 * what it isn't sent. `original` is the row being edited.
 */
export function buildBody(
  type: ContentType,
  values: Row,
  original: Row | null,
): BuiltBody {
  const body: Row = { status: values.status };
  const errors: FieldErrors = {};

  for (const field of CONTENT_CONFIG[type].fields) {
    for (const name of inputNames(field)) {
      const value = bodyValue(field, values[name]);
      if (value !== undefined) {
        body[name] = value;
      } else if (original && filled(original[name])) {
        errors[name] = "cantClear";
      } else if (!original && field.required) {
        errors[name] = "required";
      }
    }
  }

  if (original) body.id = original.id;
  const schema =
    type === "home_sections"
      ? contentUpdateBodySchemas.home_sections
      : original
        ? contentUpdateBodySchemas[type]
        : contentCreateBodySchemas[type];
  const parsed = schema.safeParse(body);
  let formError = false;
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = issue.path[0];
      if (typeof name === "string" && name in values && name !== "status") {
        errors[name] ??= "invalid";
      } else {
        formError = true;
      }
    }
  }
  return { body, errors, formError: formError && Object.keys(errors).length === 0 };
}

export type PublishState = {
  /** The languages the row will be available in. */
  locales: Locale[];
  /** Why it can't be published. Empty when it can. */
  problems: PublishProblem[];
};

/**
 * What `canPublish` will say about the row once saved: the form's values on
 * top of the row, as the route merges them. Approval comes from the row only.
 */
export function publishState(
  type: ContentType,
  values: Row,
  original: Row | null,
): PublishState {
  const { body } = buildBody(type, values, original);
  const merged: Row = { ...(original ?? {}), ...body };
  return {
    locales: availableLocales(type, merged),
    problems: publishProblems(type, merged),
  };
}

/** The row's name in `locale`, or in the other language, or null. */
export function rowTitle(type: ContentType, row: Row, locale: Locale): string | null {
  const { titleField } = CONTENT_CONFIG[type];
  if (type === "home_sections") return typeof row.key === "string" ? row.key : null;
  const order = locale === "ar" ? LOCALES : [...LOCALES].reverse();
  for (const lang of order) {
    const value = row[localizedField(titleField, lang)];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

export function rowStatus(row: Row): ContentStatus {
  return row.status === "published" ? "published" : "draft";
}

/**
 * The input names a language needs to be available, for the "required" marks.
 * A project with a hidden organization name also needs its general label.
 */
export function requiredInputNames(type: ContentType, values: Row): Set<string> {
  if (type === "home_sections") return new Set();
  const fields: string[] = [...REQUIRED_FIELDS[type]];
  if (type === "projects" && values.hideOrgName === true) fields.push("orgLabel");
  return new Set(
    fields.flatMap((field) => LOCALES.map((locale) => localizedField(field, locale))),
  );
}
