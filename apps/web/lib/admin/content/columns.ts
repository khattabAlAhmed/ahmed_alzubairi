import type { ContentType } from "@repo/shared";

/** A database row or column set, as supabase-js returns and takes it. */
export type DbRow = Record<string, unknown>;

/** An API body or row, camelCase as in `packages/shared`. */
export type ApiRow = Record<string, unknown>;

/**
 * Body fields whose column has another name. Upload fields carry a key, and
 * the database keeps it in a `*_path` (or `storage_key`) column.
 */
const RENAMES: Partial<Record<ContentType, Record<string, string>>> = {
  partners: { logoKey: "logo_path" },
  testimonials: { letterKey: "letter_path" },
  posts: { coverKey: "cover_path" },
  media_items: { imageKey: "image_path" },
  resources: { key: "storage_key" },
};

/** Fields that live in other tables (`project_images`, `project_services`). */
const NESTED = new Set(["images", "serviceIds"]);

/** Columns no API row carries (§9: `storage_key`, `approved_by`). */
const HIDDEN_COLUMNS = new Set(["storage_key", "approved_by"]);

const TIMESTAMP_COLUMNS = new Set(["created_at", "updated_at", "published_at"]);

const toSnake = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toCamel = (name: string) =>
  name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The columns a create or update body writes. Nested fields are left out. */
export function toColumns(type: ContentType, body: ApiRow): DbRow {
  const renames = RENAMES[type] ?? {};
  const columns: DbRow = {};
  for (const [field, value] of Object.entries(body)) {
    if (value === undefined || NESTED.has(field)) continue;
    columns[renames[field] ?? toSnake(field)] = value;
  }
  return columns;
}

/** ISO 8601 in UTC with a `Z`, as the shared schemas expect. */
function utc(value: unknown): unknown {
  return typeof value === "string" ? new Date(value).toISOString() : value;
}

type ProjectImageRow = {
  path: string;
  alt_ar: string | null;
  alt_en: string | null;
  position: number;
};

function projectImages(rows: unknown): ApiRow[] {
  if (!Array.isArray(rows)) return [];
  return (rows as ProjectImageRow[])
    .toSorted((a, b) => a.position - b.position)
    .map((image) =>
      withoutNulls({
        key: image.path,
        altAr: image.alt_ar,
        altEn: image.alt_en,
        position: image.position,
      }),
    );
}

function withoutNulls(row: ApiRow): ApiRow {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null),
  );
}

/** A dashboard row from a database row. Null columns are left out. */
export function fromColumns(type: ContentType, row: DbRow): ApiRow {
  const renames = Object.fromEntries(
    Object.entries(RENAMES[type] ?? {}).map(([field, column]) => [
      column,
      field,
    ]),
  );
  const api: ApiRow = {};
  for (const [column, value] of Object.entries(row)) {
    if (value === null || HIDDEN_COLUMNS.has(column)) continue;
    if (column === "project_images" || column === "project_services") continue;
    if (type === "home_sections" && column === "created_at") continue;
    api[renames[column] ?? toCamel(column)] = TIMESTAMP_COLUMNS.has(column)
      ? utc(value)
      : value;
  }
  if (type === "projects") {
    api.images = projectImages(row.project_images);
    api.serviceIds = Array.isArray(row.project_services)
      ? (row.project_services as { service_id: string }[]).map(
          (link) => link.service_id,
        )
      : [];
  }
  return api;
}

/** `project_images` rows for a body's `images`. */
export function projectImageColumns(
  projectId: string,
  images: readonly { key: string; altAr?: string; altEn?: string; position?: number }[],
): DbRow[] {
  return images.map((image, index) => ({
    project_id: projectId,
    path: image.key,
    alt_ar: image.altAr ?? null,
    alt_en: image.altEn ?? null,
    position: image.position ?? index,
  }));
}
