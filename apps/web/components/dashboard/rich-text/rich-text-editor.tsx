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
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
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
  /** A divider goes before this tool, to group headings, marks and blocks. */
  group?: boolean;
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
  { key: "bold", group: true, active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { key: "italic", active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  {
    key: "bulletList",
    group: true,
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

/**
 * Toolbar icons, after Lucide (ISC). The list and quote icons are drawn for
 * left-to-right text and mirror in an Arabic panel, where the bullets and
 * the quote bar sit on the right.
 */
const ICONS: Record<ToolKey | "link", { paths: readonly string[]; mirror?: boolean }> = {
  heading2: { paths: ["M4 12h8", "M4 18V6", "M12 18V6", "M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"] },
  heading3: {
    paths: [
      "M4 12h8",
      "M4 18V6",
      "M12 18V6",
      "M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2",
      "M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2",
    ],
  },
  bold: { paths: ["M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"] },
  italic: { paths: ["M19 4h-9", "M14 20H5", "M15 4 9 20"] },
  bulletList: {
    paths: ["M3 6h.01", "M3 12h.01", "M3 18h.01", "M8 6h13", "M8 12h13", "M8 18h13"],
    mirror: true,
  },
  orderedList: {
    paths: ["M10 6h11", "M10 12h11", "M10 18h11", "M4 6h1v4", "M4 10h2", "M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"],
    mirror: true,
  },
  blockquote: { paths: ["M17 6H3", "M21 12H8", "M21 18H8", "M3 12v6"], mirror: true },
  link: {
    paths: [
      "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
      "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    ],
  },
};

function ToolIcon({ tool, lang }: { tool: ToolKey | "link"; lang: Locale }) {
  const { paths, mirror } = ICONS[tool];
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(mirror && lang === "ar" && "-scale-x-100")}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** A thin line between tool groups. */
function ToolDivider() {
  return <span aria-hidden="true" className="mx-0.5 my-1 w-px self-stretch bg-text/20" />;
}

/**
 * An icon button. Its name is the tool's label, which also shows as a
 * tooltip on hover and on keyboard focus. The tooltip stays open while the
 * pointer is on it, and Escape hides it (WCAG 1.4.13).
 */
function ToolButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [active, setActive] = useState({ hover: false, focus: false });
  const [dismissed, setDismissed] = useState(false);
  const shown = active.hover || active.focus;

  // Once the pointer and focus leave, the next hover shows it again.
  if (!shown && dismissed) {
    setDismissed(false);
  }

  useEffect(() => {
    if (!shown) {
      return;
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", dismissOnEscape);
    return () => document.removeEventListener("keydown", dismissOnEscape);
  }, [shown]);

  return (
    <span
      className="group relative inline-flex"
      onPointerEnter={() => setActive((state) => ({ ...state, hover: true }))}
      onPointerLeave={() => setActive((state) => ({ ...state, hover: false }))}
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        onFocus={(event) =>
          setActive((state) => ({ ...state, focus: event.currentTarget.matches(":focus-visible") }))
        }
        onBlur={() => setActive((state) => ({ ...state, focus: false }))}
        className={cx(
          "inline-flex size-8 items-center justify-center rounded",
          FOCUS_RING,
          pressed ? "bg-text text-background" : "hover:bg-text/10",
        )}
      >
        {children}
      </button>
      {/*
        Centred under the button. The top padding bridges the gap, so the
        pointer can move onto it. Hidden with display while closed, so it
        never widens the page.
      */}
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-x-0 top-full z-10 justify-center pt-1",
          shown && !dismissed ? "flex" : "hidden",
        )}
      >
        <span className="rounded bg-text px-2 py-1 text-xs font-semibold whitespace-nowrap text-background shadow-md">
          {label}
        </span>
      </span>
    </span>
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
        className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-text/30 bg-surface p-1"
      >
        {TOOLS.map((tool) => (
          <Fragment key={tool.key}>
            {tool.group && <ToolDivider />}
            <ToolButton
              label={t(`tools.${tool.key}`)}
              pressed={active?.[tool.key] ?? false}
              onClick={() => editor && tool.run(editor)}
            >
              <ToolIcon tool={tool.key} lang={lang} />
            </ToolButton>
          </Fragment>
        ))}
        <ToolDivider />
        <ToolButton
          label={t("tools.link")}
          pressed={active?.link ?? false}
          onClick={() => setLinking((open) => !open)}
        >
          <ToolIcon tool="link" lang={lang} />
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
