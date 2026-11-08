// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/DashboardContent.json";
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

    type(/^Link name/, "strategic-planning");
    // Panels: Arabic first, English second.
    type(/^Title/, "Strategic planning", 1);
    type(/^Summary/, "Plans that work.", 1);
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

  it("shows why it can't be published, and doesn't send it", () => {
    renderEditor();
    type(/^Link name/, "strategic-planning");
    type(/^Title/, "تخطيط", 0);
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
    expect(screen.getByText(en.editor.required)).toBeTruthy();
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

  it("keeps a rich-text body as a note until its editor arrives", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ DashboardContent: en }}>
        <EditorHost type="expertise_areas" row={null} refOptions={{}} mediaBase="" />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByText(en.editor.laterField)).toHaveLength(2);
  });
});
