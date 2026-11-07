import "server-only";
import {
  isAvailableIn,
  LOCALES,
  type ContentType,
  type Locale,
  type TiptapDoc,
} from "@repo/shared";
import { readEnv } from "@/lib/supabase/env";

/** A row as `supabase-js` returns it: snake_case columns. */
type Row = Record<string, unknown>;

const PUBLIC_MEDIA_BUCKET = "public-media";

/** `key_result_ar` → `keyResultAr`, the API shape `isAvailableIn` reads. */
function toApiShape(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  );
}

/** Published, and the locale's required fields are filled (§6.1, §7). */
export function isPublicIn(type: ContentType, row: Row, locale: Locale) {
  return row.status === "published" && isAvailableIn(type, toApiShape(row), locale);
}

/** The languages a published row is available in, for the language switch. */
export function publicLocales(type: ContentType, row: Row): Locale[] {
  return LOCALES.filter((locale) => isPublicIn(type, row, locale));
}

/** §6.11: consent confirmed, the admin approved it, and it's published. */
export function hasPublicConsent(row: {
  consent_confirmed: boolean;
  admin_approved: boolean;
  status: string;
}) {
  return row.consent_confirmed && row.admin_approved && row.status === "published";
}

/** The locale's text column, such as `title_ar`, or null when it's blank. */
export function text(row: Row, field: string, locale: Locale): string | null {
  const value = row[`${field}_${locale}`];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** The locale's rich text column. Stored as Tiptap JSON, never HTML (§9). */
export function richText(row: Row, field: string, locale: Locale): TiptapDoc | null {
  const value = row[`${field}_${locale}`];
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc"
    ? (value as TiptapDoc)
    : null;
}

/** The public URL of a `public-media` object. No other bucket is ever public. */
export function publicMediaUrl(path: string | null): string | null {
  if (!path) return null;
  const { origin } = new URL(readEnv("NEXT_PUBLIC_SUPABASE_URL"));
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${origin}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${encoded}`;
}

/** Throws on a query error, so a page shows its error state, not empty content. */
export function rowsOrThrow<T>(result: { data: T[] | null; error: { code?: string } | null }, what: string): T[] {
  if (result.error) throw new Error(`lib/content ${what} failed: ${result.error.code ?? "unknown"}`);
  return result.data ?? [];
}
