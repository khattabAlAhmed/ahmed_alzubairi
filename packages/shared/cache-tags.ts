import { CONTENT_TYPES, type ContentType } from "./content";

/**
 * Cache tags for public content. `lib/content` tags each read with the tags of
 * the tables it reads, and the admin routes refresh a type's tag on every write
 * to it. `project_images` and `project_services` use the `projects` tag.
 */
export type ContentCacheTag = `content:${ContentType}`;

export const CONTENT_CACHE_TAGS = Object.fromEntries(
  CONTENT_TYPES.map((type) => [type, `content:${type}`]),
) as { readonly [Type in ContentType]: `content:${Type}` };

export const SITE_SETTINGS_CACHE_TAG = "site-settings";

export function contentCacheTag<Type extends ContentType>(
  type: Type,
): `content:${Type}` {
  return CONTENT_CACHE_TAGS[type];
}
