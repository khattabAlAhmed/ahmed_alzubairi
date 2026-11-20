// @vitest-environment jsdom
import { HOME_SECTION_KEYS } from "@repo/shared";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import content from "@/messages/en/DashboardContent.json";
import home from "@/messages/en/DashboardHome.json";
import arHome from "@/messages/ar/DashboardHome.json";
import { HomeEditor, type OpenForm } from "./home-editor";

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
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  replace.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const sections = HOME_SECTION_KEYS.map((key, index) => ({
  key,
  position: index + 1,
  isVisible: true,
  status: key === "contact" ? "published" : "draft",
  ...(key === "contact" ? { contentEn: { heading: "Contact" } } : {}),
}));

const stats = [
  { id: "5f2c1a8e-0000-4000-8000-000000000002", labelEn: "Projects", value: "40+", position: 2, status: "published" },
  { id: "5f2c1a8e-0000-4000-8000-000000000001", labelEn: "Years of experience", value: "15", position: 1, status: "draft" },
];

function renderHome(initialOpen: OpenForm = null) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ DashboardContent: content, DashboardHome: home }}>
      <HomeEditor sections={sections} stats={stats} mediaBase="https://x.test/m/" initialOpen={initialOpen} />
    </NextIntlClientProvider>,
  );
}

const sentBodies = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    body: JSON.parse(String(init?.body)),
  }));

const sectionList = () => screen.getByRole("list", { name: home.sections.heading });

describe("HomeEditor", () => {
  it("lists the 13 sections in order, then the stats by position", () => {
    renderHome();
    const names = within(sectionList())
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(HOME_SECTION_KEYS.map((key) => home.keys[key]));
    const statNames = within(screen.getByRole("list", { name: home.stats.heading }))
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(statNames).toEqual(["Years of experience", "Projects"]);
  });

  it("reorders with the keyboard alone, saving only the positions that changed", async () => {
    renderHome();
    const down = screen.getByRole("button", { name: "Move Hero down" });
    down.focus();
    await act(async () => {
      fireEvent.click(down);
    });

    await waitFor(() => expect(screen.getByText(home.order.saved)).toBeTruthy());
    expect(sentBodies()).toEqual([
      { url: "/api/admin/content/home_sections", method: "PATCH", body: { key: "letter", position: 1 } },
      { url: "/api/admin/content/home_sections", method: "PATCH", body: { key: "hero", position: 2 } },
    ]);
    expect(refresh).toHaveBeenCalled();
    // Focus follows the moved row.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move Hero down" })),
    );
  });

  it("can't move the first section up or the last one down", () => {
    renderHome();
    expect((screen.getByRole("button", { name: "Move Hero up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move Quick contact down" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("puts the order back when the save fails", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ error: { code: "forbidden", message: "No." } }), { status: 403 }),
    );
    renderHome();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move Media up" }));
    });
    await waitFor(() => expect(screen.getByText(home.order.failed)).toBeTruthy());
    const names = within(sectionList())
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(HOME_SECTION_KEYS.map((key) => home.keys[key]));
  });

  it("reorders by drag and drop", async () => {
    renderHome();
    const items = within(sectionList()).getAllByRole("listitem");
    const handle = items[12].querySelector("[draggable]")!;
    const dataTransfer = { setData: () => {}, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.dragOver(items[0], { dataTransfer });
    await act(async () => {
      fireEvent.drop(items[0], { dataTransfer });
    });
    await waitFor(() => expect(screen.getByText(home.order.saved)).toBeTruthy());
    expect(sentBodies()[0].body).toEqual({ key: "contact", position: 1 });
    expect(sentBodies()).toHaveLength(13);
  });

  it("hides a section through the content API", async () => {
    renderHome();
    const item = within(sectionList()).getAllByRole("listitem")[9];
    await act(async () => {
      fireEvent.click(within(item).getByLabelText(home.sections.shown));
    });
    expect(sentBodies()).toEqual([
      { url: "/api/admin/content/home_sections", method: "PATCH", body: { key: "media", isVisible: false } },
    ]);
    expect(screen.getByText("Media is now hidden from the home page.")).toBeTruthy();
    expect(within(item).getByText(home.sections.hiddenBadge)).toBeTruthy();
  });

  it("edits and publishes a section in English, with the shared publish panel", async () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Edit Featured services" }));
    const headings = screen.getAllByLabelText(/Heading/);
    // Panels: Arabic first, English second.
    fireEvent.change(headings[1], { target: { value: "What I offer" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });
    expect(screen.getByText("Will be shown in: English")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(sentBodies()).toEqual([
      {
        url: "/api/admin/content/home_sections",
        method: "PATCH",
        body: { key: "services", status: "published", contentEn: { heading: "What I offer" } },
      },
    ]);
    expect(screen.getByText(content.editor.saved)).toBeTruthy();
  });

  it("shows the Content-list note on list sections, but not on audiences, which edits its items here", () => {
    renderHome({ kind: "section", key: "services" });
    expect(screen.getByText(home.sections.rowsNote)).toBeTruthy();
    cleanup();
    renderHome({ kind: "section", key: "audiences" });
    expect(screen.queryByText(home.sections.rowsNote)).toBeNull();
  });

  it("edits the letter: paragraphs added, reordered and removed, placeholder switch, in both languages", async () => {
    const row = {
      key: "letter",
      position: 2,
      isVisible: false,
      status: "draft",
      contentAr: { heading: "رسالة", salutation: "إلى من يقرأ هذا،", paragraphs: ["أولى"], signOff: "أحمد", isPlaceholder: true },
      contentEn: { heading: "A letter", salutation: "To you,", paragraphs: ["First.", "Second."], signOff: "Ahmed", isPlaceholder: true },
    };
    render(
      <NextIntlClientProvider locale="en" messages={{ DashboardContent: content, DashboardHome: home }}>
        <HomeEditor
          sections={sections.map((section) => (section.key === "letter" ? row : section))}
          stats={stats}
          mediaBase="https://x.test/m/"
          initialOpen={{ kind: "section", key: "letter" }}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText(home.sections.rowsNote)).toBeNull();
    expect(screen.getAllByLabelText(/Salutation/)).toHaveLength(2);
    expect(screen.getAllByLabelText(/Sign-off/)).toHaveLength(2);

    // English is the second panel; its paragraphs come after Arabic's one.
    fireEvent.click(screen.getAllByRole("button", { name: home.letter.add })[1]!);
    const third = screen.getAllByLabelText(/Paragraph 3/)[0]!;
    fireEvent.change(third, { target: { value: "Third." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Move paragraph 3 up" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove paragraph 1" })[1]!);
    fireEvent.click(screen.getByLabelText(home.letter.placeholder));

    // Arabic: one paragraph can't be removed.
    expect(
      (screen.getAllByRole("button", { name: "Remove paragraph 1" })[0] as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(sentBodies()).toEqual([
      {
        url: "/api/admin/content/home_sections",
        method: "PATCH",
        body: {
          key: "letter",
          status: "draft",
          contentAr: { heading: "رسالة", salutation: "إلى من يقرأ هذا،", paragraphs: ["أولى"], signOff: "أحمد", isPlaceholder: false },
          contentEn: { heading: "A letter", salutation: "To you,", paragraphs: ["Third.", "Second."], signOff: "Ahmed", isPlaceholder: false },
        },
      },
    ]);
  });

  it("stops adding letter paragraphs at six", () => {
    renderHome({ kind: "section", key: "letter" });
    const [add] = screen.getAllByRole("button", { name: home.letter.add });
    for (let i = 0; i < 5; i++) fireEvent.click(add!);
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText((text) => text.includes(home.letter.full.replace("{max}", "6")))).toHaveLength(1);
  });

  it("refuses an SVG signature before uploading anything", async () => {
    renderHome({ kind: "section", key: "letter" });
    const [input] = document.querySelectorAll<HTMLInputElement>('input[type="file"][accept="image/png"]');
    const svg = new File(["<svg/>"], "signature.svg", { type: "image/svg+xml" });
    await act(async () => {
      fireEvent.change(input!, { target: { files: [svg] } });
    });
    expect(screen.getByText((text) => text.includes(home.letter.pngOnly))).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("won't publish a section with no complete language, and sends nothing", async () => {
    renderHome({ kind: "section", key: "media" });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(content.editor.problems.no_language).length).toBeGreaterThan(0);
  });

  it("adds a stat after the last one", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: "new-id" }), { status: 201 }));
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: home.stats.add }));
    const labels = screen.getAllByLabelText(/Label/);
    fireEvent.change(labels[1], { target: { value: "Trainees" } });
    fireEvent.change(screen.getByLabelText(/Value|Number/), { target: { value: "1,200" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(sentBodies()).toEqual([
      {
        url: "/api/admin/content/home_stats",
        method: "POST",
        body: { status: "draft", labelEn: "Trainees", value: "1,200", position: 3 },
      },
    ]);
    expect(replace).toHaveBeenCalledWith("/dashboard/home?stat=new-id&created=1");
  });

  it("opens the new stat once the page moves to it after the create", () => {
    const view = renderHome();
    fireEvent.click(screen.getByRole("button", { name: home.stats.add }));
    expect(screen.getByRole("heading", { name: home.stats.newTitle })).toBeTruthy();
    const created = { id: "5f2c1a8e-0000-4000-8000-000000000003", labelEn: "Trainees", value: "1,200", position: 3, status: "draft" };
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ DashboardContent: content, DashboardHome: home }}>
        <HomeEditor
          sections={sections}
          stats={[...stats, created]}
          mediaBase="https://x.test/m/"
          initialOpen={{ kind: "stat", id: created.id }}
          justCreated
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Close Trainees" }).getAttribute("aria-expanded")).toBe("true");
    expect((screen.getByLabelText(/Value|Number/) as HTMLInputElement).value).toBe("1,200");
    expect(screen.queryByRole("heading", { name: home.stats.newTitle })).toBeNull();
  });

  it("edits a stat's number", async () => {
    renderHome({ kind: "stat", id: stats[0].id });
    fireEvent.change(screen.getByLabelText(/Value|Number/), { target: { value: "45+" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(sentBodies()[0]).toMatchObject({
      method: "PATCH",
      body: { id: stats[0].id, value: "45+", status: "published" },
    });
  });
});

describe("DashboardHome messages", () => {
  function keyPaths(value: object, prefix = ""): string[] {
    return Object.entries(value).flatMap(([key, child]) =>
      typeof child === "object" && child !== null ? keyPaths(child, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  }

  it("has the same keys in Arabic and English", () => {
    expect(keyPaths(arHome).sort()).toEqual(keyPaths(home).sort());
  });
});
