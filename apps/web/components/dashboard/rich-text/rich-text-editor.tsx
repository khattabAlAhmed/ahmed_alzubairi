"use client";

import type { Locale, TiptapDoc } from "@repo/shared";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { Button, TextField } from "@/components/ui";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { cleanDoc } from "./allow-list";
import { isAllowedLink, richTextExtensions } from "./extensions";

/** Styles for the editing area. They match the public renderer's look. */
const CONTENT_CLASS = cx(
  "min-h-48 rounded-b-md border border-t-0 border-text/30 bg-background px-3 py-2 leading-relaxed",
  "focus:outline-2 focus:outline-offset-2 focus:outline-ring",
  "[&>*+*]:mt-3 [&_h2]:text-xl [&_h3]:text-lg [&_a]:underline [&_a]:underline-offset-4",
  "[&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6",
  "[&_blockquote]:border-s-2 [&_blockquote]:border-accent [&_blockquote]:ps-4",
);

type ToolKey =
  | "heading2"
  | "heading3"
  | "bold"
  | "italic"
  | "bulletList"
  | "orderedList"
  | "blockquote";

const TOOLS: readonly {
  key: ToolKey;
  active: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}[] = [
  {
    key: "heading2",
    active: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: "heading3",
    active: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  { key: "bold", active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { key: "italic", active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  {
    key: "bulletList",
    active: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: "orderedList",
    active: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: "blockquote",
    active: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
];

function ToolButton({
  pressed,
  onClick,
  children,
}: {
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center rounded px-2 text-xs font-semibold whitespace-nowrap",
        FOCUS_RING,
        pressed ? "bg-text text-background" : "hover:bg-text/10",
      )}
    >
      {children}
    </button>
  );
}

/** The link form under the toolbar: add, change or remove the selection's link. */
function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const t = useTranslations("DashboardEditor");
  const [href, setHref] = useState<string>(() => editor.getAttributes("link").href ?? "");
  const [error, setError] = useState(false);

  function apply() {
    const value = href.trim();
    if (value === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onDone();
      return;
    }
    if (!isAllowedLink(value)) {
      setError(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 border-x border-text/30 p-2 sm:flex-row sm:items-end">
      <TextField
        label={t("link.address")}
        hint={t("link.hint")}
        error={error ? t("link.invalid") : undefined}
        type="url"
        dir="ltr"
        value={href}
        className="min-w-0 flex-1"
        onChange={(event) => {
          setHref(event.target.value);
          setError(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={apply}>
          {t("link.apply")}
        </Button>
        <Button size="sm" variant="quiet" onClick={onDone}>
          {t("link.cancel")}
        </Button>
      </div>
    </div>
  );
}

/**
 * A Tiptap editor for one language of a rich-text field. It saves Tiptap JSON
 * only (§9 XSS), reduced to the allow-list. The editing area types in the
 * panel's language and direction: RTL for Arabic, LTR for English.
 */
export function RichTextEditor({
  value,
  onChange,
  lang,
  label,
  hint,
  error,
}: {
  value: TiptapDoc | null;
  onChange: (doc: TiptapDoc) => void;
  lang: Locale;
  label: string;
  hint?: string;
  error?: string;
}) {
  const t = useTranslations("DashboardEditor");
  const id = useId();
  const [linking, setLinking] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");

  const editor = useEditor({
    extensions: richTextExtensions(),
    // The stored JSON passes the allow-list before the editor sees it.
    content: value ? (cleanDoc(value) as JSONContent) : undefined,
    // The page is rendered on the server; the editor starts in the browser.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: `${id}-input`,
        lang,
        dir: lang === "ar" ? "rtl" : "ltr",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": `${id}-label`,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": "true" } : {}),
        class: CONTENT_CLASS,
      },
    },
    onUpdate: ({ editor: current }) => onChange(cleanDoc(current.getJSON())),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: current }): Record<ToolKey | "link", boolean> | null =>
      current
        ? ({
            ...Object.fromEntries(TOOLS.map((tool) => [tool.key, tool.active(current)])),
            link: current.isActive("link"),
          } as Record<ToolKey | "link", boolean>)
        : null,
  });

  return (
    <div>
      <p id={`${id}-label`} className="mb-1 text-sm font-semibold">
        {label}
      </p>
      {hint && (
        <p id={`${id}-hint`} className="mb-1 text-sm text-text-secondary">
          {hint}
        </p>
      )}
      <div
        role="toolbar"
        aria-label={t("toolbar")}
        aria-controls={`${id}-input`}
        className="flex flex-wrap gap-1 rounded-t-md border border-text/30 bg-surface p-1"
      >
        {TOOLS.map((tool) => (
          <ToolButton
            key={tool.key}
            pressed={active?.[tool.key] ?? false}
            onClick={() => editor && tool.run(editor)}
          >
            {t(`tools.${tool.key}`)}
          </ToolButton>
        ))}
        <ToolButton pressed={active?.link ?? false} onClick={() => setLinking((open) => !open)}>
          {t("tools.link")}
        </ToolButton>
      </div>
      {linking && editor && <LinkForm editor={editor} onDone={() => setLinking(false)} />}
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className={CONTENT_CLASS} aria-hidden="true" />
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
