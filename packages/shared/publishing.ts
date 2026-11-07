import type { ContentType } from "./content";
import { LOCALES, type Locale } from "./enums";
import {
  homeSectionContentSchemas,
  homeSectionKeySchema,
} from "./home-sections";

/**
 * Translation and publish rules (§6.1, §6.11, §7). Both the dashboard routes
 * and `lib/content` use these, on rows in the API shape (camelCase, as in
 * `ContentRow`). A database `null` counts as not filled.
 */

/** Content types whose rows are plain `<field>Ar` / `<field>En` columns. */
export type FieldContentType = Exclude<ContentType, "home_sections">;

/**
 * The localized fields a row needs in a language to be available in it. A
 * `home_sections` row instead needs `content<Lang>` to pass its key's schema.
 * A project with `hideOrgName` also needs `orgLabel<Lang>`.
 */
export const REQUIRED_FIELDS = {
  home_stats: ["label"],
  pages: ["title", "body"],
  timeline_items: ["title"],
  expertise_areas: ["title", "summary"],
  services: ["title", "summary"],
  projects: ["title", "goal"],
  faqs: ["question", "answer"],
  partners: ["name"],
  testimonials: ["quote", "author"],
  posts: ["slug", "title", "body"],
  resources: ["title"],
  media_items: ["title"],
} as const satisfies Record<FieldContentType, readonly string[]>;

/** Content types that need consent and admin approval before publishing (§6.11). */
export const CONSENT_CONTENT_TYPES = ["partners", "testimonials"] as const;

const LOCALE_SUFFIX: Record<Locale, "Ar" | "En"> = { ar: "Ar", en: "En" };

/** `title` + `ar` → `titleAr`. */
export function localizedField(field: string, locale: Locale): string {
  return `${field}${LOCALE_SUFFIX[locale]}`;
}

function read(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

/** True when a Tiptap node or any node under it has non-blank text. */
function hasText(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  const { text, content } = node as { text?: unknown; content?: unknown };
  if (typeof text === "string" && text.trim() !== "") return true;
  return Array.isArray(content) && content.some(hasText);
}

/** Filled: a non-blank string, a number, or a Tiptap document with text. */
export function isFilled(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object" && value !== null) {
    return (value as { type?: unknown }).type === "doc" && hasText(value);
  }
  return false;
}

/** True when the row's required fields for `locale` are filled (§7). */
export function isAvailableIn(
  type: ContentType,
  row: object,
  locale: Locale,
): boolean {
  if (type === "home_sections") {
    const key = homeSectionKeySchema.safeParse(read(row, "key"));
    if (!key.success) return false;
    const content = read(row, localizedField("content", locale));
    return homeSectionContentSchemas[key.data].safeParse(content).success;
  }

  const required: readonly string[] = REQUIRED_FIELDS[type];
  const filled = required.every((field) =>
    isFilled(read(row, localizedField(field, locale))),
  );
  if (!filled) return false;

  if (type === "projects" && read(row, "hideOrgName") === true) {
    return isFilled(read(row, localizedField("orgLabel", locale)));
  }
  return true;
}

/** The languages the row is available in. */
export function availableLocales(type: ContentType, row: object): Locale[] {
  return LOCALES.filter((locale) => isAvailableIn(type, row, locale));
}

export const PUBLISH_PROBLEMS = [
  "no_language",
  "no_value",
  "no_consent",
  "not_approved",
] as const;

export type PublishProblem = (typeof PUBLISH_PROBLEMS)[number];

/** Why the row can't be published. Empty when it can. */
export function publishProblems(
  type: ContentType,
  row: object,
): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (availableLocales(type, row).length === 0) problems.push("no_language");
  if (type === "home_stats" && !isFilled(read(row, "value"))) {
    problems.push("no_value");
  }
  if ((CONSENT_CONTENT_TYPES as readonly string[]).includes(type)) {
    if (read(row, "consentConfirmed") !== true) problems.push("no_consent");
    if (read(row, "adminApproved") !== true) problems.push("not_approved");
  }
  return problems;
}

/**
 * True when the row may be `published`: available in at least one language,
 * and for partners and testimonials, consent confirmed and admin approved.
 */
export function canPublish(type: ContentType, row: object): boolean {
  return publishProblems(type, row).length === 0;
}
