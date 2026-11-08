import {
  AUDIENCE_ITEM_COUNT,
  availableLocales,
  homeSectionContentSchemas,
  LOCALES,
  publishProblems,
  type HomeSectionKey,
  type Locale,
  type PublishProblem,
} from "@repo/shared";
import type { FieldProblem } from "../content/form-values";

/**
 * The form of one home section, built from its shared schema
 * (`homeSectionContentSchemas`, §6.2). Each language is a flat map of field
 * paths (`heading`, `items.0.title`) to text. The hero photo is one value for
 * both languages.
 */

export type SectionField = {
  /** A path into the content object, such as `items.1.description`. */
  path: string;
  /** The message key of its label, under `DashboardHome.fields`. */
  label: "heading" | "intro" | "name" | "title" | "valueStatement" | "itemTitle" | "itemDescription";
  long: boolean;
  required: boolean;
  /** For audience items: which one (0-based). */
  item?: number;
};

const heading: SectionField[] = [
  { path: "heading", label: "heading", long: false, required: true },
  { path: "intro", label: "intro", long: true, required: false },
];

export function sectionFields(key: HomeSectionKey): SectionField[] {
  if (key === "hero") {
    return [
      { path: "name", label: "name", long: false, required: true },
      { path: "title", label: "title", long: false, required: true },
      { path: "valueStatement", label: "valueStatement", long: false, required: true },
    ];
  }
  if (key === "audiences") {
    const items = Array.from({ length: AUDIENCE_ITEM_COUNT }, (_, item): SectionField[] => [
      { path: `items.${item}.title`, label: "itemTitle", long: false, required: true, item },
      { path: `items.${item}.description`, label: "itemDescription", long: true, required: false, item },
    ]).flat();
    return [...heading, ...items];
  }
  return heading;
}

export type LangValues = Record<string, string>;

export type SectionValues = {
  ar: LangValues;
  en: LangValues;
  /** Hero only: the `media` upload key of the personal photo, or "". */
  photoKey: string;
};

function readPath(content: unknown, path: string): unknown {
  let node: unknown = content;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function contentOf(row: Record<string, unknown> | null, locale: Locale): unknown {
  return row?.[locale === "ar" ? "contentAr" : "contentEn"];
}

/** The form's starting values, from the saved row. */
export function sectionValues(
  key: HomeSectionKey,
  row: Record<string, unknown> | null,
): SectionValues {
  const lang = (locale: Locale): LangValues =>
    Object.fromEntries(
      sectionFields(key).map((field) => {
        const value = readPath(contentOf(row, locale), field.path);
        return [field.path, typeof value === "string" ? value : ""];
      }),
    );
  const photo = LOCALES.map((locale) => readPath(contentOf(row, locale), "photoKey")).find(
    (value): value is string => typeof value === "string" && value !== "",
  );
  return { ar: lang("ar"), en: lang("en"), photoKey: key === "hero" ? (photo ?? "") : "" };
}

/** Errors by input name: `<locale>.<path>`, such as `en.items.0.title`. */
export type SectionErrors = Record<string, FieldProblem>;

export function inputName(locale: Locale, path: string): string {
  return `${locale}.${path}`;
}

/** One language's content object, or undefined when every field is blank. */
function buildLang(key: HomeSectionKey, values: LangValues, photoKey: string) {
  const fields = sectionFields(key);
  if (fields.every((field) => (values[field.path] ?? "").trim() === "")) return undefined;

  const content: Record<string, unknown> = {};
  if (key === "audiences") {
    content.items = Array.from({ length: AUDIENCE_ITEM_COUNT }, () => ({}));
  }
  for (const field of fields) {
    const value = (values[field.path] ?? "").trim();
    if (value === "") continue;
    const parts = field.path.split(".");
    if (parts[0] === "items") {
      (content.items as Record<string, unknown>[])[Number(parts[1])][parts[2]] = value;
    } else {
      content[field.path] = value;
    }
  }
  if (key === "hero" && photoKey !== "") content.photoKey = photoKey;
  return content;
}

export type BuiltSection = {
  /** The `PATCH /api/admin/content/home_sections` body. */
  body: Record<string, unknown>;
  errors: SectionErrors;
};

/**
 * The PATCH body for a section, with each language checked against the key's
 * shared schema. A blank language is left out, so the API keeps what it has;
 * a language that had content can't be emptied (the API can't clear it).
 */
export function buildSection(
  key: HomeSectionKey,
  values: SectionValues,
  status: string,
  original: Record<string, unknown> | null,
): BuiltSection {
  const body: Record<string, unknown> = { key, status };
  const errors: SectionErrors = {};
  const schema = homeSectionContentSchemas[key];

  for (const locale of LOCALES) {
    const name = locale === "ar" ? "contentAr" : "contentEn";
    const content = buildLang(key, values[locale], values.photoKey);
    if (content === undefined) {
      if (contentOf(original, locale) != null) {
        const first = sectionFields(key).find((field) => field.required);
        if (first) errors[inputName(locale, first.path)] = "cantClear";
      }
      continue;
    }
    const parsed = schema.safeParse(content);
    if (parsed.success) {
      body[name] = parsed.data;
      continue;
    }
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      const field = sectionFields(key).find((item) => item.path === path);
      if (!field) continue;
      const blank = (values[locale][path] ?? "").trim() === "";
      errors[inputName(locale, path)] ??= blank ? "required" : "invalid";
    }
  }
  return { body, errors };
}

export type SectionPublishState = { locales: Locale[]; problems: PublishProblem[] };

/** What `canPublish` will say once saved: the form's content on top of the row. */
export function sectionPublishState(
  key: HomeSectionKey,
  values: SectionValues,
  status: string,
  original: Record<string, unknown> | null,
): SectionPublishState {
  const { body } = buildSection(key, values, status, original);
  const merged = { ...(original ?? {}), ...body, key };
  return {
    locales: availableLocales("home_sections", merged),
    problems: publishProblems("home_sections", merged),
  };
}
