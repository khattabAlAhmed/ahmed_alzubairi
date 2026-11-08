/**
 * Cache Components needs at least one static param per route. With no
 * published rows, this placeholder is built instead: it matches no row, so it
 * renders the not-found page like any other unknown slug.
 */
export const NO_SLUG_PLACEHOLDER = "-";

export function staticSlugs(slugs: string[]): { slug: string }[] {
  return (slugs.length > 0 ? slugs : [NO_SLUG_PLACEHOLDER]).map((slug) => ({ slug }));
}

/**
 * A slug from the URL, decoded once. Slugs never contain "%", so a value that
 * fails to decode can't match a row and stays as is, to reach the not-found page.
 */
export function routeSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
