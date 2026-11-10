// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardContent.json";
import en from "@/messages/en/DashboardContent.json";
import editorEn from "@/messages/en/DashboardEditor.json";
import { GenericEditor, type ContentEditorProps } from "./content-editor";
import { EditorHost } from "./editor-host";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  replace.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderEditor(props: Partial<ContentEditorProps> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ DashboardContent: en }}>
      <GenericEditor type="services" row={null} refOptions={{}} mediaBase="https://x.test/m/" {...props} />
    </NextIntlClientProvider>,
  );
}

const type = (label: RegExp, value: string, index = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[index], { target: { value } });

describe("GenericEditor", () => {
  it("creates a service in English only, then opens its edit page", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "new-id" }), { status: 201 }));
    renderEditor();

    type(/Link name/, "strategic-planning");
    // Panels: Arabic first, English second.
    type(/Title/, "Strategic planning", 1);
    type(/Summary/, "Plans that work.", 1);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });

    expect(screen.getByText("Will be shown in: English")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/content/edit?type=services&id=new-id&created=1"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/content/services");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      status: "published",
      slug: "strategic-planning",
      titleEn: "Strategic planning",
      summaryEn: "Plans that work.",
      isFeatured: false,
    });
  });

  it("names the languages in the UI language inside the publishing sentence", () => {
    // Panels: Arabic first, English second.
    const fill = (messages: typeof en, index: number, title: string, summary: string) => {
      type(new RegExp(messages.fields.title), title, index);
      type(new RegExp(messages.fields.summary), summary, index);
    };
    renderEditor();
    fill(en, 0, "تخطيط", "خطط ناجحة.");
    expect(screen.getByText("Will be shown in: Arabic")).toBeTruthy();
    fill(en, 1, "Strategic planning", "Plans that work.");
    expect(screen.getByText("Will be shown in: Arabic and English")).toBeTruthy();
    cleanup();

    render(
      <NextIntlClientProvider locale="ar" messages={{ DashboardContent: ar }}>
        <GenericEditor type="services" row={null} refOptions={{}} mediaBase="https://x.test/m/" />
      </NextIntlClientProvider>,
    );
    fill(ar, 0, "تخطيط", "خطط ناجحة.");
    fill(ar, 1, "Strategic planning", "Plans that work.");
    const sentence = screen.getByText("سيظهر بـ: العربية والإنجليزية");
    expect(sentence.textContent).not.toMatch(/[A-Za-z]/);
  });

  it("shows why it can't be published, and doesn't send it", () => {
    renderEditor();
    type(/Link name/, "strategic-planning");
    type(/Title/, "تخطيط", 0);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert").textContent).toContain(en.editor.cantPublish);
    expect(screen.getAllByText(en.editor.problems.no_language).length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a missing required field and doesn't send it", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(en.editor.fixErrors)).toBeTruthy();
    expect(screen.getByText(en.editor.required, { exact: false })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message when the save is refused", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "conflict", message: "That link name is taken." } }), {
        status: 409,
      }),
    );
    renderEditor({ row: { id: "6f9c2a7e-1b2d-4c3e-8f4a-5b6c7d8e9f01", status: "draft", slug: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("That link name is taken.")).toBeTruthy());
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
  });

  it("says when an update was saved, and reloads the row", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    renderEditor({ row: { id: "6f9c2a7e-1b2d-4c3e-8f4a-5b6c7d8e9f01", status: "draft", slug: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText(en.editor.saved)).toBeTruthy());
    expect(refresh).toHaveBeenCalled();
  });

  it("isolates labels, so English labels keep their punctuation in the RTL panel", () => {
    renderEditor();
    const arabicTitle = screen.getAllByLabelText(/Title/)[0];
    const label = document.querySelector(`label[for="${arabicTitle.id}"]`);
    expect(label?.textContent).toBe(`\u2068Title ${en.editor.requiredMark}\u2069`);
  });

  it("edits a rich-text body in each language and saves it as JSON", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "new-id" }), { status: 201 }));
    render(
      <NextIntlClientProvider locale="en" messages={{ DashboardContent: en, DashboardEditor: editorEn }}>
        <EditorHost type="expertise_areas" row={null} refOptions={{}} mediaBase="" />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByRole("toolbar", { name: editorEn.toolbar })).toHaveLength(2);
    const areas = await waitFor(() => {
      const found = document.querySelectorAll<HTMLElement & { editor?: Editor }>(".ProseMirror");
      if (found.length !== 2) throw new Error("editors not ready");
      return [...found];
    });
    expect(areas.map((area) => area.getAttribute("dir"))).toEqual(["rtl", "ltr"]);

    act(() => {
      areas[1].editor?.commands.setContent("<h2>About</h2><p><strong>Hello</strong></p>", { emitUpdate: true });
    });
    type(/Link name/, "governance");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.bodyEn).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "About" }] },
        { type: "paragraph", content: [{ type: "text", text: "Hello", marks: [{ type: "bold" }] }] },
      ],
    });
    expect(body.bodyAr).toBeUndefined();
  });
});
