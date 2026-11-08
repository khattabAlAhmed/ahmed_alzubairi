import type { TiptapDoc } from "@repo/shared";
import { safeHref } from "@/components/public/rich-text";

/**
 * What the dashboard editor may store (§9 XSS). Every entry is one the public
 * renderer (`components/public/rich-text`) draws; `allow-list.test.tsx`
 * checks that against the renderer itself.
 */
export const ALLOWED_NODES = [
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
] as const;

export const ALLOWED_MARKS = ["bold", "italic", "link"] as const;

/** The page owns its h1, so content headings are h2 and h3 only. */
export const HEADING_LEVELS = [2, 3] as const;

type AllowedNode = (typeof ALLOWED_NODES)[number];
type AllowedMark = (typeof ALLOWED_MARKS)[number];

type JsonMark = { type: AllowedMark; attrs?: { href: string } };
type JsonNode = {
  type: AllowedNode;
  text?: string;
  attrs?: Record<string, number>;
  marks?: JsonMark[];
  content?: JsonNode[];
};

/** Deeper than any real document; stops a crafted one from recursing forever. */
const MAX_DEPTH = 32;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const isAllowed = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

function cleanMarks(value: unknown): JsonMark[] {
  if (!Array.isArray(value)) return [];
  const marks: JsonMark[] = [];
  for (const raw of value) {
    const mark = record(raw);
    if (!mark || !isAllowed(ALLOWED_MARKS, mark.type)) continue;
    if (marks.some((kept) => kept.type === mark.type)) continue;
    if (mark.type === "link") {
      const link = safeHref(record(mark.attrs)?.href);
      // A link the renderer would refuse, such as `javascript:`, is dropped; its text stays.
      if (link) marks.push({ type: "link", attrs: { href: link.href } });
    } else {
      marks.push({ type: mark.type });
    }
  }
  return marks;
}

function cleanAttrs(type: AllowedNode, value: unknown): Record<string, number> | undefined {
  const attrs = record(value);
  if (type === "heading") {
    const level = attrs?.level;
    return { level: typeof level === "number" && level >= 3 ? 3 : 2 };
  }
  if (type === "orderedList") {
    const start = attrs?.start;
    return typeof start === "number" && Number.isInteger(start) && start > 1
      ? { start }
      : undefined;
  }
  return undefined;
}

function cleanNode(value: unknown, depth: number): JsonNode | null {
  const node = record(value);
  if (!node || depth > MAX_DEPTH || !isAllowed(ALLOWED_NODES, node.type)) return null;
  const type = node.type;
  if (type === "doc") return null;
  if (type === "text") {
    if (typeof node.text !== "string" || node.text === "") return null;
    const marks = cleanMarks(node.marks);
    return marks.length > 0 ? { type, text: node.text, marks } : { type, text: node.text };
  }
  const out: JsonNode = { type };
  const attrs = cleanAttrs(type, node.attrs);
  if (attrs) out.attrs = attrs;
  if (Array.isArray(node.content)) {
    const content = node.content
      .map((child) => cleanNode(child, depth + 1))
      .filter((child): child is JsonNode => child !== null);
    if (content.length > 0) out.content = content;
  }
  return out;
}

/**
 * The document reduced to the allow-list: unknown nodes are dropped with
 * their children, unknown marks and attributes are removed, links keep only
 * an http, https or mailto `href`. The editor saves only this.
 */
export function cleanDoc(value: unknown): TiptapDoc {
  const doc = record(value);
  const content = Array.isArray(doc?.content)
    ? doc.content
        .map((child) => cleanNode(child, 1))
        .filter((child): child is JsonNode => child !== null)
    : [];
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}
