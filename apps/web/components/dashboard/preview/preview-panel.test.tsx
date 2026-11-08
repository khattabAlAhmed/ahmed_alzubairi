// @vitest-environment jsdom
import type { ContentType } from "@repo/shared";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enBase from "@/messages/en.json";
import enCatalog from "@/messages/en/Catalog.json";
import enContact from "@/messages/en/Contact.json";
import enHome from "@/messages/en/Home.json";
import enPages from "@/messages/en/Pages.json";
import preview from "@/messages/en/DashboardPreview.json";
import arPreview from "@/messages/ar/DashboardPreview.json";
import type { ContentEditorState } from "../content/content-editor";
import type { Row } from "../content/form-values";
import { PreviewPanel } from "./preview-panel";

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: false }) }));
vi.mock("@/components/consultation-button", () => ({
  ConsultationButton: () => <button type="button">requestConsultation</button>,
}));
vi.mock("@/components/language-switch", () => ({ LanguageFallback: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: unknown; children: ReactNode; className?: string }) => (
    <a href={typeof href === "string" ? href : "#"} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
const loadPublicMessages = vi.hoisted(() => vi.fn());
vi.mock("./public-messages", () => ({ loadPublicMessages }));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  fetchMock.mockReset();
  loadPublicMessages.mockReset();
  loadPublicMessages.mockResolvedValue({
    ...enBase,
    Pages: enPages,
    Catalog: enCatalog,
    Home: enHome,
    Contact: enContact,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function editor(type: ContentType, values: Row, original: Row | null = null): ContentEditorState {
  return {
    ctx: { type, values, original, refOptions: {}, mediaBase: "https://m.test/", errors: {}, requiredNames: new Set(), setValue: () => {} },
  } as unknown as ContentEditorState;
}

function renderPanel(state: ContentEditorState) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <PreviewPanel editor={state} />
    </NextIntlClientProvider>,
  );
}

const service = {
  id: "s",
  slug: "strategy",
  status: "draft",
  titleEn: "Strategic planning draft",
  summaryEn: "A summary not saved yet.",
};

async function open() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: preview.show }));
  });
}

describe("PreviewPanel", () => {
  it("draws nothing for a type without a public page component", () => {
    const { container } = renderPanel(editor("faqs", { questionEn: "Q", answerEn: "A" }));
    expect(container.innerHTML).toBe("");
  });

  it("stays closed and loads nothing until asked", () => {
    renderPanel(editor("services", service));
    expect(screen.getByRole("button", { name: preview.show }).getAttribute("aria-expanded")).toBe("false");
    expect(loadPublicMessages).not.toHaveBeenCalled();
  });

  it("previews the unsaved draft in a frame, with the language, theme and width controls", async () => {
    renderPanel(editor("services", service));
    await open();
    expect(loadPublicMessages).toHaveBeenCalledWith("en");
    expect(screen.getByRole("radio", { name: "English" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: preview.light })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Phone (375 px)" })).toHaveProperty("checked", true);
    expect(screen.getByText(preview.draftNote)).toBeTruthy();
    expect(screen.getByText(preview.serviceLimits)).toBeTruthy();
    const frame = screen.getByTitle("Preview of the public page in English") as HTMLIFrameElement;
    await waitFor(() => expect(frame.contentDocument?.body.textContent).toContain("Strategic planning draft"));
    expect(frame.contentDocument?.documentElement.getAttribute("dir")).toBe("ltr");

    fireEvent.click(screen.getByRole("radio", { name: preview.dark }));
    expect(frame.contentDocument?.documentElement.classList.contains("dark")).toBe(true);
    // Read-only: nothing was sent anywhere.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says when the chosen language isn't complete, and draws no page", async () => {
    renderPanel(editor("services", service));
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "العربية" }));
    });
    expect(loadPublicMessages).toHaveBeenCalledWith("ar");
    expect(screen.getByText("Not complete in العربية, so the public site won't show it in this language.")).toBeTruthy();
    expect(screen.queryByTitle(/Preview of the public page/)).toBeNull();
  });

  it("warns that an unapproved testimonial won't appear publicly yet", async () => {
    renderPanel(
      editor("testimonials", { quoteEn: "Great work", authorEn: "A. B.", consentConfirmed: true, status: "draft" }, {
        id: "t",
        adminApproved: false,
      }),
    );
    await open();
    expect(screen.getByText(preview.notPublicYet)).toBeTruthy();
    expect(screen.getByText(preview.blockers.not_approved)).toBeTruthy();
    expect(screen.queryByText(preview.blockers.no_consent)).toBeNull();
  });

  it("explains a hidden-name project shows its label", async () => {
    renderPanel(
      editor("projects", {
        titleEn: "Water",
        goalEn: "Clean water",
        orgNameEn: "Secret Org",
        orgLabelEn: "An international NGO",
        hideOrgName: true,
      }),
    );
    await open();
    expect(screen.getByText(preview.hiddenName)).toBeTruthy();
    const frame = screen.getByTitle("Preview of the public page in English") as HTMLIFrameElement;
    await waitFor(() => expect(frame.contentDocument?.body.textContent).toContain("An international NGO"));
    expect(frame.contentDocument?.body.textContent).not.toContain("Secret Org");
  });

  it("shows a notice when the public messages fail to load", async () => {
    loadPublicMessages.mockRejectedValueOnce(new Error("offline"));
    renderPanel(editor("services", service));
    await open();
    expect(screen.getByText(preview.loadFailed)).toBeTruthy();
  });
});

describe("DashboardPreview messages", () => {
  const keys = (value: unknown, prefix = ""): string[] =>
    value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
      : [prefix.slice(0, -1)];

  it("has the same keys in Arabic and English", () => {
    expect(keys(arPreview).sort()).toEqual(keys(preview).sort());
  });
});
