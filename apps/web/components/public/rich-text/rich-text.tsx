import type { TiptapDoc } from "@repo/shared";
import type { ReactNode } from "react";
import { cx, INLINE_LINK } from "@/components/ui/cx";

/**
 * Renders stored Tiptap JSON (§9 XSS) through an allow-list of the nodes and
 * marks the editor's StarterKit makes. Everything is a React element or React
 * text, so stored text can never become HTML: a "<script>" in a text node
 * shows as those characters. An unknown node is dropped with its children.
 * There's no `dangerouslySetInnerHTML` anywhere here.
 */

type JsonNode = {
  type?: unknown;
  text?: unknown;
  attrs?: unknown;
  marks?: unknown;
  content?: unknown;
};

/** Deeper than any real document; stops a crafted one from recursing forever. */
const MAX_DEPTH = 32;

const LINK_CLASS = INLINE_LINK;

function isNode(value: unknown): value is JsonNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function children(node: JsonNode): JsonNode[] {
  return Array.isArray(node.content) ? node.content.filter(isNode) : [];
}

function attr(node: JsonNode, name: string): unknown {
  return isNode(node.attrs) ? (node.attrs as Record<string, unknown>)[name] : undefined;
}

/**
 * A link target the page may render: http(s) or mailto only. Anything else,
 * such as `javascript:` or `data:`, returns null and the text shows unlinked.
 */
export function safeHref(value: unknown): { href: string; external: boolean } | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol === "mailto:") return { href: url.href, external: false };
  if (url.protocol === "http:" || url.protocol === "https:") return { href: url.href, external: true };
  return null;
}

function renderText(node: JsonNode, key: number): ReactNode {
  if (typeof node.text !== "string" || node.text === "") return null;
  let out: ReactNode = node.text;
  const marks = Array.isArray(node.marks) ? node.marks.filter(isNode) : [];
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "underline":
        out = <u>{out}</u>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "code":
        out = <code dir="ltr" className="bg-surface px-1 font-mono text-[0.9em]">{out}</code>;
        break;
      case "link": {
        const link = safeHref(attr(mark, "href"));
        if (link) {
          out = (
            <a href={link.href} className={LINK_CLASS} rel={link.external ? "noopener noreferrer" : undefined}>
              {out}
            </a>
          );
        }
        break;
      }
      // Unknown marks are ignored: the text still shows, unstyled.
    }
  }
  return <span key={key}>{out}</span>;
}

function headingLevel(node: JsonNode): 2 | 3 | 4 {
  // The page owns its h1, so content headings start at h2.
  const level = attr(node, "level");
  if (level === 3) return 3;
  if (typeof level === "number" && level >= 4) return 4;
  return 2;
}

function renderNode(node: JsonNode, key: number, depth: number): ReactNode {
  if (depth > MAX_DEPTH) return null;
  const inner = () => children(node).map((child, index) => renderNode(child, index, depth + 1));

  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "paragraph":
      return (
        <p key={key} className="text-pretty">
          {inner()}
        </p>
      );
    case "heading": {
      const level = headingLevel(node);
      const Tag = `h${level}` as const;
      // h2 opens a part of the text with a hairline; smaller ones only step down.
      const size = level === 2 ? "mt-4 border-t border-line pt-3.5 type-h2" : level === 3 ? "mt-2 type-h3" : "font-semibold";
      return (
        <Tag key={key} className={cx("text-balance", size)}>
          {inner()}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="flex list-disc flex-col gap-1.5 ps-6 marker:text-ink-2">
          {inner()}
        </ul>
      );
    case "orderedList": {
      const start = attr(node, "start");
      return (
        <ol
          key={key}
          className="flex list-decimal flex-col gap-1.5 ps-7 tabular-nums marker:text-ink-2"
          start={typeof start === "number" && Number.isInteger(start) ? start : undefined}
        >
          {inner()}
        </ol>
      );
    }
    case "listItem":
      return (
        <li key={key} className="[&>p]:inline">
          {inner()}
        </li>
      );
    case "blockquote":
      return (
        <blockquote key={key} className="flex flex-col gap-3 border-s-2 border-rule ps-5 text-[1.17em] leading-[1.95]">
          {inner()}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre key={key} dir="ltr" className="overflow-x-auto bg-surface p-4 font-mono text-sm">
          <code>{children(node).map((child) => (typeof child.text === "string" ? child.text : "")).join("")}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} className="border-line" />;
    default:
      return null;
  }
}

/**
 * Long-form text for an article (ArticleBody board): 18px with a loose line
 * height, at the reading measure. Arabic and English each keep their own.
 */
export const ARTICLE_PROSE = "max-w-measure text-[18px] leading-[2.05] [&:lang(en)]:text-[17px] [&:lang(en)]:leading-[1.7]";

export function RichText({ doc, className }: { doc: TiptapDoc; className?: string }) {
  if (!isNode(doc) || doc.type !== "doc") return null;
  return (
    <div className={cx("flex flex-col gap-5 type-body", className)}>
      {children(doc).map((node, index) => renderNode(node, index, 1))}
    </div>
  );
}

/** True when the node or anything under it has visible text. */
function hasText(node: JsonNode, depth = 0): boolean {
  if (depth > MAX_DEPTH) return false;
  if (node.type === "text") return typeof node.text === "string" && node.text.trim() !== "";
  return children(node).some((child) => hasText(child, depth + 1));
}

/**
 * Splits off the first paragraph with text, for a page that shows it as an
 * intro. `rest` is null when nothing with text follows.
 */
export function splitLead(doc: TiptapDoc): { lead: TiptapDoc | null; rest: TiptapDoc | null } {
  const nodes = children(doc as JsonNode);
  const index = nodes.findIndex((node) => node.type === "paragraph" && hasText(node));
  if (index === -1) return { lead: null, rest: doc };
  const rest = nodes.filter((_, i) => i !== index);
  return {
    lead: { type: "doc", content: [nodes[index]] } as TiptapDoc,
    rest: rest.some((node) => hasText(node)) ? ({ type: "doc", content: rest } as TiptapDoc) : null,
  };
}
