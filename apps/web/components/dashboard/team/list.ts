import { DEFAULT_PAGE_SIZE } from "@repo/shared";

export type RawParams = Record<string, string | string[] | undefined>;

/** The two calls `parseParams` needs from a zod schema. */
type Schema<T> = {
  safeParse: (value: unknown) => { success: boolean };
  parse: (value: unknown) => T;
};

/**
 * A list's params from the page's query string. Only `keys` are read, and a
 * value the schema refuses is dropped, so a bad link still opens the list.
 */

export function parseParams<T>(schema: Schema<T>, keys: readonly string[], raw: RawParams): T {
  const kept = Object.fromEntries(
    keys.flatMap((key) => {
      const value = raw[key];
      const one = Array.isArray(value) ? value[0] : value;
      if (one === undefined || one.trim() === "") return [];
      return schema.safeParse({ [key]: one }).success ? [[key, one]] : [];
    }),
  );
  return schema.parse(kept);
}

/** The list's address with these values. Empty values and defaults are left out. */
export function listPath(
  base: string,
  values: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    if (key === "page" && value === 1) continue;
    if (key === "pageSize" && value === DEFAULT_PAGE_SIZE) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/** How many pages `total` rows fill; at least one. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
