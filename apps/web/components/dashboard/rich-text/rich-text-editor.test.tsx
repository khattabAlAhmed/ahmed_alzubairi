// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { tiptapDocSchema, type TiptapDoc } from "@repo/shared";
import type { Editor } from "@tiptap/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardEditor.json";
import en from "@/messages/en/DashboardEditor.json";
import { RichTextEditor } from "./rich-text-editor";

if (typeof globalThis.ClipboardEvent === "undefined") {
  class ClipboardEventPolyfill extends Event {
    clipboardData: DataTransfer | null = null;
  }
  globalThis.ClipboardEvent = ClipboardEventPolyfill as unknown as typeof ClipboardEvent;
}

afterEach(cleanup);

const doc: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

function setup(lang: "ar" | "en", value: TiptapDoc | null = doc) {
  const onChange = vi.fn<(doc: TiptapDoc) => void>();
  render(
    <NextIntlClientProvider locale="en" messages={{ DashboardEditor: en }}>
      <RichTextEditor lang={lang} value={value} onChange={onChange} label="Body" />
    </NextIntlClientProvider>,
  );
  return { onChange };
}

async function editorElement() {
  return waitFor(() => {
    const element = document.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror");
    if (!element) throw new Error("no editor yet");
    return element;
  });
}

describe("RichTextEditor", () => {
  it("types RTL in the Arabic panel and LTR in the English one", async () => {
    setup("ar");
    const arabic = await editorElement();
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(arabic.getAttribute("lang")).toBe("ar");
    expect(arabic.textContent).toBe("Hello");
    cleanup();

    setup("en");
    const english = await editorElement();
    expect(english.getAttribute("dir")).toBe("ltr");
    expect(english.getAttribute("lang")).toBe("en");
  });

  it("names the editing area with its label, and shows every tool", async () => {
    setup("en");
    expect(await screen.findByRole("textbox", { name: "Body" })).toBeTruthy();
    const toolbar = screen.getByRole("toolbar", { name: en.toolbar });
    for (const label of Object.values(en.tools)) {
      expect(toolbar.textContent).toContain(label);
    }
  });

  it("refuses a javascript: link in the link form", async () => {
    setup("en");
    await editorElement();
    fireEvent.click(screen.getByRole("button", { name: en.tools.link }));
    fireEvent.change(screen.getByLabelText(en.link.address), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: en.link.apply }));
    expect(screen.getByText(en.link.invalid)).toBeTruthy();
  });

  it("saves pasted HTML as clean JSON", async () => {
    const { onChange } = setup("en", null);
    const element = await editorElement();
    // Tiptap keeps its editor on the editing element.
    const editor = element.editor;
    expect(editor).toBeTruthy();
    act(() => {
      editor?.view.pasteHTML('<p>Hi <a href="javascript:alert(1)">bad</a><script>alert(1)</script></p>');
    });
    expect(onChange).toHaveBeenCalled();
    const saved = onChange.mock.lastCall?.[0];
    expect(tiptapDocSchema.safeParse(saved).success).toBe(true);
    expect(JSON.stringify(saved)).not.toMatch(/javascript:|script/);
    expect(JSON.stringify(saved)).toContain("bad");
  });

  it("has the same keys in Arabic and English", () => {
    const keys = (obj: object, prefix = ""): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === "object" ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
});
