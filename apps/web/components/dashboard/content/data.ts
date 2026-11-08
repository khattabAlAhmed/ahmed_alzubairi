import "server-only";
import type { ContentType, Locale } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromColumns } from "@/lib/admin/content/columns";
import type { ContentStore } from "@/lib/admin/content/handlers";
import { createContentStore } from "@/lib/admin/content/store";
import { readEnv } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import type { RefOption } from "./field-text";
import { rowTitle, type Row } from "./form-values";
import { referenceTypes } from "./registry";

/**
 * Dashboard reads, through the same store as the content API. Reads use the
 * user's client, so RLS decides what they see. Call these only after
 * `requireSection` allowed `content.manage`.
 */
function store(): ContentStore {
  return createContentStore(
    createUserClient() as unknown as SupabaseClient,
    createServiceClient() as unknown as SupabaseClient,
  );
}

/** Every row of a type, in the API shape, in dashboard order. */
export async function loadRows(type: ContentType): Promise<Row[]> {
  const rows = await store().list(type);
  return rows.map((row) => fromColumns(type, row));
}

/** One row to edit: `home_sections` by key, the others by id. */
export async function loadRow(type: ContentType, ref: string): Promise<Row | null> {
  const column = type === "home_sections" ? "key" : "id";
  // Ids are uuids: anything else can't match, and Postgres would refuse it.
  if (column === "id" && !UUID.test(ref)) return null;
  const row = await store().get(type, { column, value: ref });
  return row ? fromColumns(type, row) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The rows reference fields can point at, named in the page language. */
export async function loadRefOptions(
  type: ContentType,
  locale: Locale,
  untitled: string,
): Promise<Partial<Record<ContentType, RefOption[]>>> {
  const types = referenceTypes(type);
  const lists = await Promise.all(types.map((refType) => loadRows(refType)));
  return Object.fromEntries(
    types.map((refType, index) => [
      refType,
      lists[index].map((row) => ({
        id: String(row.id),
        title: rowTitle(refType, row, locale) ?? untitled,
      })),
    ]),
  );
}

/** The public URL prefix of `public-media`, for image previews. */
export function mediaBase(): string {
  const { origin } = new URL(readEnv("NEXT_PUBLIC_SUPABASE_URL"));
  return `${origin}/storage/v1/object/public/public-media/`;
}
