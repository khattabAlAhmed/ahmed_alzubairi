"use client";

import { GenericEditor, type ContentEditorProps } from "./content-editor";
import { CUSTOM_EDITORS } from "./custom-editors";

/** The type's custom editor when one is registered, else the generic one. */
export function EditorHost(props: ContentEditorProps) {
  const Editor = CUSTOM_EDITORS[props.type] ?? GenericEditor;
  return <Editor {...props} />;
}
