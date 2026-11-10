// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function setup(lang: "ar" | "en", value: TiptapDoc | null = doc, ui: "ar" | "en" = "en") {
  const onChange = vi.fn<(doc: TiptapDoc) => void>();
  render(
    <NextIntlClientProvider locale={ui} messages={{ DashboardEditor: ui === "ar" ? ar : en }}>
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

/** A message as read, without its `<ltr>` tags. */
const plain = (message: string) => message.replace(/<\/?ltr>/g, "");

/** The text a screen reader reads with the control. */
const describedBy = (control: HTMLElement) =>
  (control.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");

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

  it("names the editing area with its label, and names every tool button", async () => {
    setup("en");
    expect(await screen.findByRole("textbox", { name: "Body" })).toBeTruthy();
    const toolbar = screen.getByRole("toolbar", { name: en.toolbar });
    const buttons = within(toolbar).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(Object.values(en.tools));
    for (const button of buttons) {
      expect(button.getAttribute("type")).toBe("button");
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.className).toContain("focus-visible:outline-ring");
    }
  });

  it("shows each tool's label as a tooltip, hidden from screen readers", async () => {
    setup("en");
    await editorElement();
    const bold = screen.getByRole("button", { name: en.tools.bold });
    const tooltip = () => bold.nextElementSibling as HTMLElement;
    expect(tooltip().getAttribute("aria-hidden")).toBe("true");
    expect(tooltip().textContent).toBe(en.tools.bold);
    // Closed, it takes no space.
    expect(tooltip().className).toMatch(/(^| )hidden( |$)/);

    fireEvent.pointerEnter(bold.parentElement as HTMLElement);
    expect(tooltip().className).toMatch(/(^| )flex( |$)/);
    // The tooltip sits inside the hovered group, so moving onto it keeps it open.
    expect(tooltip().className).not.toContain("pointer-events-none");
    expect(bold.parentElement?.contains(tooltip())).toBe(true);

    fireEvent.pointerLeave(bold.parentElement as HTMLElement);
    expect(tooltip().className).toMatch(/(^| )hidden( |$)/);
  });

  it("hides an open tooltip on Escape, until the pointer leaves", async () => {
    setup("en");
    await editorElement();
    const italic = screen.getByRole("button", { name: en.tools.italic });
    const group = italic.parentElement as HTMLElement;
    const tooltip = () => italic.nextElementSibling as HTMLElement;
    fireEvent.pointerEnter(group);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tooltip().className).toMatch(/(^| )hidden( |$)/);

    fireEvent.pointerLeave(group);
    fireEvent.pointerEnter(group);
    expect(tooltip().className).toMatch(/(^| )flex( |$)/);
  });

  it("survives a mouse click on a tool while the editor isn't focused", async () => {
    setup("en");
    const element = await editorElement();
    act(() => {
      element.editor?.commands.selectAll();
    });
    expect(document.activeElement).not.toBe(element);
    const bold = screen.getByRole("button", { name: en.tools.bold });
    // A real click: the pointer moves onto the button, then mouse-down focuses
    // it. The focus update runs after React has cleared currentTarget.
    await userEvent.click(bold);
    expect(screen.getByRole("toolbar", { name: en.toolbar })).toBeTruthy();
    await waitFor(() => expect(bold.getAttribute("aria-pressed")).toBe("true"));
  });

  it("marks a tool as pressed once it applies to the selection", async () => {
    setup("en");
    const element = await editorElement();
    act(() => {
      element.editor?.commands.selectAll();
    });
    const bold = screen.getByRole("button", { name: en.tools.bold });
    fireEvent.click(bold);
    await waitFor(() => expect(bold.getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(bold);
    await waitFor(() => expect(bold.getAttribute("aria-pressed")).toBe("false"));
  });

  it("opens the link form from the keyboard, as a native button", async () => {
    setup("en");
    await editorElement();
    const link = screen.getByRole("button", { name: en.tools.link });
    link.focus();
    expect(document.activeElement).toBe(link);
    // A native <button> turns Enter and Space into a click.
    fireEvent.click(link);
    expect(screen.getByLabelText(en.link.address)).toBeTruthy();
    expect(link.getAttribute("aria-pressed")).toBe("false");
  });

  it("mirrors the list and quote icons in the Arabic panel only", async () => {
    setup("ar");
    await editorElement();
    const mirrored = (name: string) =>
      screen.getByRole("button", { name }).querySelector("svg")?.getAttribute("class") ?? "";
    expect(mirrored(en.tools.bulletList)).toContain("-scale-x-100");
    expect(mirrored(en.tools.blockquote)).toContain("-scale-x-100");
    expect(mirrored(en.tools.bold)).not.toContain("-scale-x-100");
    cleanup();

    setup("en");
    await editorElement();
    expect(mirrored(en.tools.bulletList)).not.toContain("-scale-x-100");
  });

  it("refuses a javascript: link in the link form", async () => {
    setup("en");
    await editorElement();
    fireEvent.click(screen.getByRole("button", { name: en.tools.link }));
    fireEvent.change(screen.getByLabelText(en.link.address), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: en.link.apply }));
    const address = screen.getByLabelText(en.link.address);
    expect(address.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe(plain(en.link.invalid));
    expect(describedBy(address)).toContain(plain(en.link.invalid));
  });

  it.each([
    ["ar", ar],
    ["en", en],
  ] as const)("isolates https://, http:// and mailto: in the %s link hint and error", async (ui, messages) => {
    setup("ar", doc, ui);
    await editorElement();
    fireEvent.click(screen.getByRole("button", { name: messages.tools.link }));
    const address = screen.getByLabelText(messages.link.address);
    fireEvent.change(address, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: messages.link.apply }));

    const hint = document.getElementById(`${address.id}-hint`) as HTMLElement;
    const error = screen.getByRole("alert");
    // The wording is the message's, with no tag left in it.
    expect(hint.textContent).toBe(plain(messages.link.hint));
    expect(error.textContent).toBe(plain(messages.link.invalid));
    expect(describedBy(address)).toBe(`${plain(messages.link.hint)} ${plain(messages.link.invalid)}`);
    for (const sentence of [hint, error]) {
      const tokens = [...sentence.querySelectorAll("bdi")];
      expect(tokens.map((token) => token.textContent)).toEqual(["https://", "http://", "mailto:"]);
      for (const token of tokens) {
        expect(token.getAttribute("dir")).toBe("ltr");
      }
    }
  });

  it.each([
    ["ar", "en", ar, "rtl"],
    ["en", "ar", en, "ltr"],
  ] as const)(
    "gives the link form the %s UI's direction on the %s content tab",
    async (ui, tab, messages, direction) => {
      // The language tab panel sets the content's direction around the editor.
      const onChange = vi.fn<(doc: TiptapDoc) => void>();
      render(
        <NextIntlClientProvider locale={ui} messages={{ DashboardEditor: messages }}>
          <div lang={tab} dir={tab === "ar" ? "rtl" : "ltr"}>
            <RichTextEditor lang={tab} value={doc} onChange={onChange} label="Body" />
          </div>
        </NextIntlClientProvider>,
      );
      const content = await editorElement();
      fireEvent.click(screen.getByRole("button", { name: messages.tools.link }));
      const address = screen.getByLabelText(messages.link.address);
      const hint = document.getElementById(`${address.id}-hint`) as HTMLElement;

      // The nearest direction and language above the hint are the UI's.
      expect(hint.closest("[dir]")?.getAttribute("dir")).toBe(direction);
      expect(hint.closest("[lang]")?.getAttribute("lang")).toBe(ui);
      // The address stays left to right, and the content keeps its tab's direction.
      expect(address.getAttribute("dir")).toBe("ltr");
      expect(content.getAttribute("dir")).toBe(tab === "ar" ? "rtl" : "ltr");
      // The toolbar isn't part of the form: it still follows the tab.
      const toolbar = screen.getByRole("toolbar", { name: messages.toolbar });
      expect(toolbar.closest("[dir]")?.getAttribute("dir")).toBe(tab === "ar" ? "rtl" : "ltr");
    },
  );

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
