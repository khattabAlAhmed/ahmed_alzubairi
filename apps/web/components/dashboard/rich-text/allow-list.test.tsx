// @vitest-environment jsdom
import { tiptapDocSchema, type TiptapDoc } from "@repo/shared";
import { Editor } from "@tiptap/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { RichText } from "@/components/public/rich-text";
import { ALLOWED_MARKS, ALLOWED_NODES, cleanDoc, HEADING_LEVELS } from "./allow-list";
import { richTextExtensions } from "./extensions";

// jsdom has no ClipboardEvent; ProseMirror's pasteHTML creates one for the paste.
if (typeof globalThis.ClipboardEvent === "undefined") {
  class ClipboardEventPolyfill extends Event {
    clipboardData: DataTransfer | null = null;
  }
  globalThis.ClipboardEvent = ClipboardEventPolyfill as unknown as typeof ClipboardEvent;
}

const editors: Editor[] = [];
function makeEditor(content?: string) {
  const editor = new Editor({ extensions: richTextExtensions(), content });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

const render = (doc: unknown) => renderToStaticMarkup(<RichText doc={doc as TiptapDoc} />);

/** A minimal document that holds one node of `type`. */
function docWith(type: string): unknown {
  const text = { type: "text", text: "x" };
  const paragraph = { type: "paragraph", content: [text] };
  switch (type) {
    case "doc":
      return { type: "doc", content: [paragraph] };
    case "text":
    case "paragraph":
      return { type: "doc", content: [paragraph] };
    case "heading":
      return { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [text] }] };
    case "listItem":
    case "bulletList":
      return { type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [paragraph] }] }] };
    case "orderedList":
      return { type: "doc", content: [{ type: "orderedList", content: [{ type: "listItem", content: [paragraph] }] }] };
    case "blockquote":
      return { type: "doc", content: [{ type: "blockquote", content: [paragraph] }] };
    case "hardBreak":
      return { type: "doc", content: [{ type: "paragraph", content: [text, { type: "hardBreak" }, text] }] };
    default:
      return { type: "doc", content: [{ type, content: [text] }] };
  }
}

const TAGS: Record<string, string> = {
  doc: "<p",
  text: "x",
  paragraph: "<p",
  heading: "<h2",
  bulletList: "<ul",
  orderedList: "<ol",
  listItem: "<li",
  blockquote: "<blockquote",
  hardBreak: "<br",
};

describe("editor schema against the public renderer", () => {
  it("makes only nodes and marks on the allow-list", () => {
    const { schema } = makeEditor();
    expect(Object.keys(schema.nodes).sort()).toEqual([...ALLOWED_NODES].sort());
    expect(Object.keys(schema.marks).sort()).toEqual([...ALLOWED_MARKS].sort());
    expect(schema.nodes.heading.spec.attrs).toBeTruthy();
  });

  it.each(ALLOWED_NODES.map((type) => [type]))("the renderer draws %s", (type) => {
    expect(render(docWith(type))).toContain(TAGS[type]);
  });

  it.each([
    ["bold", { type: "bold" }, "<strong>"],
    ["italic", { type: "italic" }, "<em>"],
    ["link", { type: "link", attrs: { href: "https://example.org/" } }, 'href="https://example.org/"'],
  ])("the renderer draws the %s mark", (_, mark, expected) => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [mark] }] }] };
    expect(render(doc)).toContain(expected);
  });

  it("offers headings 2 and 3 only", () => {
    expect([...HEADING_LEVELS]).toEqual([2, 3]);
    const editor = makeEditor("<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4>");
    const levels = (editor.getJSON().content ?? [])
      .filter((node) => node.type === "heading")
      .map((node) => node.attrs?.level);
    expect(levels).toEqual([2, 3]);
  });
});

describe("cleanDoc", () => {
  it("keeps an allowed document as it is", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Title" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bold", marks: [{ type: "bold" }] },
            { type: "text", text: "mail", marks: [{ type: "link", attrs: { href: "mailto:a@example.org" } }] },
          ],
        },
      ],
    };
    expect(cleanDoc(doc)).toEqual(doc);
  });

  it("drops unknown nodes, marks and attributes, and unsafe links", () => {
    const cleaned = cleanDoc({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://x.test/a.png" } },
        { type: "codeBlock", content: [{ type: "text", text: "alert(1)" }] },
        {
          type: "paragraph",
          attrs: { textAlign: "center", dir: "rtl" },
          content: [
            {
              type: "text",
              text: "click",
              marks: [
                { type: "link", attrs: { href: "javascript:alert(1)", target: "_blank" } },
                { type: "underline" },
                { type: "bold", attrs: { style: "x" } },
              ],
            },
          ],
        },
        { type: "heading", attrs: { level: 1, id: "h" }, content: [{ type: "text", text: "H" }] },
        { type: "orderedList", attrs: { start: 1, type: null }, content: [] },
      ],
    });
    expect(cleaned).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "click", marks: [{ type: "bold" }] }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H" }] },
        { type: "orderedList" },
      ],
    });
    expect(tiptapDocSchema.safeParse(cleaned).success).toBe(true);
  });

  it("gives an empty document one empty paragraph", () => {
    expect(cleanDoc(null)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(cleanDoc({ type: "doc", content: [] })).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("stops at a crafted, very deep document", () => {
    let node: Record<string, unknown> = { type: "text", text: "deep" };
    for (let i = 0; i < 100; i += 1) node = { type: "blockquote", content: [node] };
    expect(() => cleanDoc({ type: "doc", content: [node] })).not.toThrow();
    expect(JSON.stringify(cleanDoc({ type: "doc", content: [node] }))).not.toContain("deep");
  });
});

describe("pasting HTML", () => {
  const dirty = [
    "<h1>Title</h1>",
    "<style>p { color: red }</style>",
    '<p style="color:red" onclick="alert(1)">Hello <script>alert("x")</script><b>bold</b>',
    ' <a href="javascript:alert(1)">bad link</a>',
    ' <a href="https://example.org/page" target="_blank">good link</a>',
    ' <a href="mailto:a@example.org">mail</a>',
    ' <a href="data:text/html,hi">data</a></p>',
    '<img src="https://x.test/a.png"><pre><code>code()</code></pre><table><tr><td>cell</td></tr></table>',
    "<ul><li>One</li></ul><blockquote><p>Quote</p></blockquote><hr><u>under</u> <s>strike</s>",
  ].join("");

  it("keeps only allowed formatting, and saves JSON matching tiptapDocSchema", () => {
    const editor = makeEditor();
    editor.view.pasteHTML(dirty);
    const saved = cleanDoc(editor.getJSON());
    const json = JSON.stringify(saved);

    expect(tiptapDocSchema.safeParse(saved).success).toBe(true);
    expect(json).not.toContain("script");
    expect(json).not.toContain('alert("x")');
    expect(json).not.toContain("color");
    expect(json).not.toContain("javascript:");
    expect(json).not.toContain("data:");
    expect(json).not.toContain("onclick");
    expect(json).not.toMatch(/"type":"(image|codeBlock|table|horizontalRule|underline|strike)"/);
    expect(json).toContain('"href":"https://example.org/page"');
    expect(json).toContain('"href":"mailto:a@example.org"');
    // The text of a refused link stays, unlinked.
    expect(json).toContain("bad link");
    // Every node type in the saved JSON is on the allow-list.
    const types = new Set<string>();
    const walk = (node: { type?: string; content?: unknown[] }) => {
      if (node.type) types.add(node.type);
      (node.content ?? []).forEach((child) => walk(child as typeof node));
    };
    walk(saved as { type?: string; content?: unknown[] });
    for (const type of types) expect(ALLOWED_NODES as readonly string[]).toContain(type);
  });

  it("refuses a javascript: link even before the save filter", () => {
    const editor = makeEditor();
    editor.view.pasteHTML('<p><a href="javascript:alert(1)">x</a> <a href="JAVASCRIPT:alert(1)">y</a></p>');
    expect(JSON.stringify(editor.getJSON())).not.toMatch(/javascript:/i);
  });
});
