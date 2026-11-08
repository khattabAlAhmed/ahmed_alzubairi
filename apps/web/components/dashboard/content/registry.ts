import {
  CONTENT_TYPES,
  FAQ_CATEGORIES,
  MEDIA_CATEGORIES,
  ORG_TYPES,
  RESOURCE_ACCESS_MODES,
  RESOURCE_KINDS,
  TIMELINE_KINDS,
  type ContentType,
  type UploadTarget,
} from "@repo/shared";

/**
 * What each content type's editor shows. The generic editor reads this and
 * draws one input per field, so a new field is one line here.
 *
 * Plug-in points for later tasks:
 * - Rich text (P2P-T13): register a renderer for the `richtext` kind in
 *   `FIELD_RENDERERS` (`field-input.tsx`). Until then those fields show a note.
 * - Home sections (P2P-T14): add an editor to `CUSTOM_EDITORS` in
 *   `custom-editors.ts`.
 * - Testimonials and partners (P2P-T15): extend their fields here, or give
 *   them a custom editor the same way.
 */

/** The option sets select fields use. Labels live under `options.<set>`. */
export const OPTION_SETS = {
  timelineKind: TIMELINE_KINDS,
  orgType: ORG_TYPES,
  faqCategory: FAQ_CATEGORIES,
  mediaCategory: MEDIA_CATEGORIES,
  resourceKind: RESOURCE_KINDS,
  resourceAccess: RESOURCE_ACCESS_MODES,
} as const;

export type OptionSet = keyof typeof OPTION_SETS;

type Base = {
  /** The body field (camelCase). Localized fields are the base name: `title` → `titleAr`, `titleEn`. */
  name: string;
  /** Needed to create a row (the shared create schema requires it). */
  required?: boolean;
};

export type FieldDef = Base &
  (
    | { kind: "text" | "longtext" | "richtext"; localized: true }
    | { kind: "text" | "slug" | "url" | "date" }
    | { kind: "number" }
    | { kind: "boolean" }
    | { kind: "select"; options: OptionSet }
    /** One row of another type, by id. */
    | { kind: "reference"; refType: ContentType }
    /** Several rows of another type, by id. */
    | { kind: "references"; refType: ContentType }
    /** One uploaded file; the body carries its key. `image` shows a preview. */
    | { kind: "image" | "file"; target: UploadTarget }
    /** A project's images: keys with alt text in both languages. */
    | { kind: "images"; target: UploadTarget }
  );

export type FieldKind = FieldDef["kind"];

export type TypeConfig = {
  /** The localized field that names a row in lists, such as `title`. */
  titleField: string;
  fields: readonly FieldDef[];
};

const L = (name: string, kind: "text" | "longtext" | "richtext" = "text") =>
  ({ name, kind, localized: true }) as const;
const position = { name: "position", kind: "number" } as const;
const expertise = {
  name: "expertiseId",
  kind: "reference",
  refType: "expertise_areas",
} as const;

export const CONTENT_CONFIG: Record<ContentType, TypeConfig> = {
  home_sections: {
    titleField: "key",
    fields: [],
  },
  home_stats: {
    titleField: "label",
    fields: [L("label"), { name: "value", kind: "text" }, position],
  },
  pages: {
    titleField: "title",
    fields: [L("title"), L("body", "richtext")],
  },
  timeline_items: {
    titleField: "title",
    fields: [
      { name: "kind", kind: "select", options: "timelineKind", required: true },
      L("title"),
      L("description", "longtext"),
      { name: "period", kind: "text" },
      position,
    ],
  },
  expertise_areas: {
    titleField: "title",
    fields: [
      { name: "slug", kind: "slug", required: true },
      L("title"),
      L("summary", "longtext"),
      L("body", "richtext"),
      position,
    ],
  },
  services: {
    titleField: "title",
    fields: [
      { name: "slug", kind: "slug", required: true },
      expertise,
      L("title"),
      L("summary", "longtext"),
      L("audience", "longtext"),
      L("deliverables", "longtext"),
      L("stages", "longtext"),
      { name: "isFeatured", kind: "boolean" },
      position,
    ],
  },
  projects: {
    titleField: "title",
    fields: [
      { name: "slug", kind: "slug", required: true },
      expertise,
      { name: "orgType", kind: "select", options: "orgType" },
      L("title"),
      L("orgName"),
      L("orgLabel"),
      { name: "hideOrgName", kind: "boolean" },
      L("goal", "longtext"),
      L("role", "longtext"),
      L("duration"),
      L("activities", "longtext"),
      L("results", "longtext"),
      L("keyResult"),
      { name: "isFeatured", kind: "boolean" },
      { name: "images", kind: "images", target: "media" },
      { name: "serviceIds", kind: "references", refType: "services" },
    ],
  },
  faqs: {
    titleField: "question",
    fields: [
      { name: "category", kind: "select", options: "faqCategory", required: true },
      { name: "serviceId", kind: "reference", refType: "services" },
      L("question"),
      L("answer", "longtext"),
      position,
    ],
  },
  partners: {
    titleField: "name",
    fields: [
      L("name"),
      { name: "logoKey", kind: "image", target: "media" },
      { name: "consentConfirmed", kind: "boolean" },
      position,
    ],
  },
  testimonials: {
    titleField: "author",
    fields: [
      L("quote", "longtext"),
      L("author"),
      { name: "partnerId", kind: "reference", refType: "partners" },
      { name: "letterKey", kind: "file", target: "letter" },
      { name: "consentConfirmed", kind: "boolean" },
      position,
    ],
  },
  posts: {
    titleField: "title",
    fields: [
      L("slug"),
      expertise,
      L("title"),
      L("excerpt", "longtext"),
      L("body", "richtext"),
      { name: "coverKey", kind: "image", target: "media" },
    ],
  },
  resources: {
    titleField: "title",
    fields: [
      { name: "kind", kind: "select", options: "resourceKind", required: true },
      expertise,
      L("title"),
      L("description", "longtext"),
      { name: "key", kind: "file", target: "resource", required: true },
      { name: "access", kind: "select", options: "resourceAccess", required: true },
    ],
  },
  media_items: {
    titleField: "title",
    fields: [
      { name: "category", kind: "select", options: "mediaCategory", required: true },
      L("title"),
      L("outlet"),
      { name: "date", kind: "date" },
      { name: "imageKey", kind: "image", target: "media" },
      { name: "url", kind: "url" },
      { name: "videoUrl", kind: "url" },
    ],
  },
};

/** The types the content list shows, in menu order. */
export const LISTED_TYPES: readonly ContentType[] = CONTENT_TYPES;

/** Reads a `?type=` value, or null when it isn't a content type. */
export function parseContentType(value: unknown): ContentType | null {
  return typeof value === "string" &&
    (CONTENT_TYPES as readonly string[]).includes(value)
    ? (value as ContentType)
    : null;
}

/**
 * True when this type has an editor: a custom one, or the generic one when
 * the type has fields. Fields whose kind has no renderer yet (`richtext`
 * until P2P-T13) show a note instead and keep their saved value.
 */
export function isEditable(
  type: ContentType,
  { customEditor = false }: { customEditor?: boolean } = {},
): boolean {
  return customEditor || CONTENT_CONFIG[type].fields.length > 0;
}

/** True when a type can get new rows: `home_sections` and `pages` are fixed sets. */
export function canCreate(type: ContentType): boolean {
  return type !== "home_sections" && type !== "pages";
}

/** The reference types an editor needs to load, for its selects. */
export function referenceTypes(type: ContentType): ContentType[] {
  const refs = CONTENT_CONFIG[type].fields.flatMap((field) =>
    field.kind === "reference" || field.kind === "references"
      ? [field.refType]
      : [],
  );
  return [...new Set(refs)];
}

/** Home sections and quick stats have their own page (P2P-T14). */
export const HOME_EDITOR_PATH = "/dashboard/home";

/** A type's list. */
export function listPath(type: ContentType): string {
  if (type === "home_sections" || type === "home_stats") return HOME_EDITOR_PATH;
  return `/dashboard/content?type=${type}`;
}

/** The page that adds a row of a type. */
export function newPath(type: ContentType): string {
  return `/dashboard/content/new?type=${type}`;
}

/**
 * The edit page of a row, by id (or key for `home_sections`). Home sections
 * and stats open on the home page editor, with that row's form open.
 */
export function editPath(type: ContentType, id: string): string {
  const ref = encodeURIComponent(id);
  if (type === "home_sections") return `${HOME_EDITOR_PATH}?section=${ref}`;
  if (type === "home_stats") return `${HOME_EDITOR_PATH}?stat=${ref}`;
  return `/dashboard/content/edit?type=${type}&id=${ref}`;
}
