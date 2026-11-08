import type { ContentType } from "@repo/shared";
import type { ComponentType } from "react";
import type { ContentEditorProps } from "./content-editor";

/**
 * Editors that replace the generic one for a type. Each is a client component
 * that takes `ContentEditorProps`, and can build on `useContentEditor`,
 * `EditorForm` and `FieldInput` from `content-editor.tsx`.
 *
 * P2P-T15 may add `testimonials` and `partners`. Home sections and quick
 * stats don't come here: they have their own page, `/dashboard/home`. No page or list changes are needed: a type with an entry
 * becomes editable on its own.
 */
export const CUSTOM_EDITORS: Partial<
  Record<ContentType, ComponentType<ContentEditorProps>>
> = {};

export function hasCustomEditor(type: ContentType): boolean {
  return type in CUSTOM_EDITORS;
}
