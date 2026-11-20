import {
  AUDIENCE_ITEM_COUNT,
  availableLocales,
  homeSectionContentSchemas,
  LETTER_MAX_PARAGRAPHS,
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
 * both languages. The letter adds its paragraphs (a list per language), and its
 * signatures and placeholder switch (one value for both languages).
 */

export type SectionField = {
  /** A path into the content object, such as `items.1.description`. */
  path: string;
  /** The message key of its label, under `DashboardHome.fields`. */
  label:
    | "heading"
    | "intro"
    | "name"
    | "title"
    | "valueStatement"
    | "itemTitle"
    | "itemDescription"
    | "salutation"
    | "signOff";
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
  if (key === "letter") {
    return [
      { path: "heading", label: "heading", long: false, required: true },
      { path: "salutation", label: "salutation", long: false, required: true },
      { path: "signOff", label: "signOff", long: false, required: true },
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

/** The letter's fields that aren't one line of text per language. */
export type LetterValues = {
  paragraphs: Record<Locale, string[]>;
  /** `media` upload keys, or "": dark ink (light theme), light ink (dark theme). */
  signatureKey: string;
  signatureDarkKey: string;
  isPlaceholder: boolean;
};

export type SectionValues = {
  ar: LangValues;
  en: LangValues;
  /** Hero only: the `media` upload key of the personal photo, or "". */
  photoKey: string;
  /** Letter only. */
  letter?: LetterValues;
};

/** The two signature fields, by their content key. */
export const SIGNATURE_FIELDS = ["signatureKey", "signatureDarkKey"] as const;

export type SignatureField = (typeof SIGNATURE_FIELDS)[number];

/**
 * A signature scan is a PNG, never an SVG: the picker offers only PNG, and a
 * file of another type isn't sent. The contract takes only `.png` keys.
 */
export const SIGNATURE_MIMES = ["image/png"] as const;
export const SIGNATURE_ACCEPT = SIGNATURE_MIMES.join(",");

export function isSignatureFile(file: { name: string; type: string }): boolean {
  return (
    (SIGNATURE_MIMES as readonly string[]).includes(file.type) && /\.png$/i.test(file.name)
  );
}

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
  const shared = (path: string) =>
    LOCALES.map((locale) => readPath(contentOf(row, locale), path)).find(
      (value): value is string => typeof value === "string" && value !== "",
    ) ?? "";
  const values: SectionValues = {
    ar: lang("ar"),
    en: lang("en"),
    photoKey: key === "hero" ? shared("photoKey") : "",
  };
  if (key === "letter") {
    const paragraphs = (locale: Locale): string[] => {
      const list = readPath(contentOf(row, locale), "paragraphs");
      const texts = Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
      return texts.length > 0 ? texts.slice(0, LETTER_MAX_PARAGRAPHS) : [""];
    };
    const flags = LOCALES.map((locale) => readPath(contentOf(row, locale), "isPlaceholder")).filter(
      (value): value is boolean => typeof value === "boolean",
    );
    values.letter = {
      paragraphs: { ar: paragraphs("ar"), en: paragraphs("en") },
      signatureKey: shared("signatureKey"),
      signatureDarkKey: shared("signatureDarkKey"),
      // A new letter starts as a placeholder; a saved one keeps its flag.
      isPlaceholder: flags.length === 0 ? true : flags.some(Boolean),
    };
  }
  return values;
}

/** Moves one paragraph of one language up (-1) or down (+1). */
export function moveParagraph(list: readonly string[], index: number, by: -1 | 1): string[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target] as string, next[index] as string];
  return next;
}

/** Errors by input name: `<locale>.<path>`, such as `en.items.0.title`. */
export type SectionErrors = Record<string, FieldProblem>;

export function inputName(locale: Locale, path: string): string {
  return `${locale}.${path}`;
}

/** One language's content object, or undefined when every field is blank. */
function buildLang(key: HomeSectionKey, values: SectionValues, locale: Locale) {
  const fields = sectionFields(key);
  const lang = values[locale];
  const paragraphs = values.letter?.paragraphs[locale] ?? [];
  const blank =
    fields.every((field) => (lang[field.path] ?? "").trim() === "") &&
    paragraphs.every((paragraph) => paragraph.trim() === "");
  if (blank) return undefined;

  const content: Record<string, unknown> = {};
  if (key === "audiences") {
    content.items = Array.from({ length: AUDIENCE_ITEM_COUNT }, () => ({}));
  }
  for (const field of fields) {
    const value = (lang[field.path] ?? "").trim();
    if (value === "") continue;
    const parts = field.path.split(".");
    if (parts[0] === "items") {
      (content.items as Record<string, unknown>[])[Number(parts[1])][parts[2]] = value;
    } else {
      content[field.path] = value;
    }
  }
  if (key === "hero" && values.photoKey !== "") content.photoKey = values.photoKey;
  if (key === "letter" && values.letter) {
    // Blank paragraphs stay in, so the form can point at them.
    content.paragraphs = paragraphs.map((paragraph) => paragraph.trim());
    for (const field of SIGNATURE_FIELDS) {
      if (values.letter[field] !== "") content[field] = values.letter[field];
    }
    content.isPlaceholder = values.letter.isPlaceholder;
  }
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
    const content = buildLang(key, values, locale);
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
      if (issue.path[0] === "paragraphs") {
        const index = issue.path[1];
        const text = typeof index === "number" ? (values.letter?.paragraphs[locale][index] ?? "") : "";
        errors[inputName(locale, path)] ??= typeof index === "number" && text.trim() !== "" ? "invalid" : "required";
        continue;
      }
      if (SIGNATURE_FIELDS.some((field) => field === path)) {
        errors[path] ??= "invalid";
        continue;
      }
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
