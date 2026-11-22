// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import enDialog from "@/messages/en/DocumentRequestDialog.json";
import { DocumentsList } from "./documents-list";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/components/clerk/auth-state", () => {
  const signedOut = { isLoaded: true, isSignedIn: false, email: null };
  return {
    useAuthState: () => signedOut,
    readAuth: () => signedOut,
    whenClerkLoaded: async () => signedOut,
    requestClerk: () => {},
  };
});
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => router, Link: () => null }));
vi.mock("next-intl", async (original) => {
  const actual = await original<typeof import("next-intl")>();
  return {
    ...actual,
    // Catalog keys come back as their names; the dialog's strings are real.
    useTranslations: (namespace: string) =>
      namespace === "Catalog" ? (key: string) => key : actual.useTranslations(namespace as never),
  };
});

afterEach(cleanup);

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function show(documents: Parameters<typeof DocumentsList>[0]["documents"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ DocumentRequestDialog: enDialog }}>
      <DocumentsList documents={documents} />
    </NextIntlClientProvider>,
  );
}

const C = "33333333-3333-4333-8333-333333333333";

describe("DocumentsList", () => {
  it("lists titles in the shared category order under real tabs, each with a request button and a box", () => {
    show([
      { id: B, title: "Thanks letter", category: "thank_you_letter" },
      { id: A, title: "Course", category: "course_certificate" },
    ]);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "documentsPage.all",
      "documentCategory.course_certificate1",
      "documentCategory.thank_you_letter1",
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs[0].id);
    const titles = [...panel.querySelectorAll("li")].map((row) => row.querySelector("span.font-semibold")?.textContent);
    expect(titles).toEqual(["Course", "Thanks letter"]);
    expect(screen.getByRole("button", { name: "Request to view: Course" }).textContent).toBe("Request to view");
    expect(screen.getByLabelText("Select Thanks letter")).toBeTruthy();
  });

  it("moves between tabs with the arrow keys, Home and End, and shows only that category", () => {
    show([
      { id: A, title: "Course", category: "course_certificate" },
      { id: B, title: "Thanks letter", category: "thank_you_letter" },
    ]);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs[0].getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tabpanel").textContent).toContain("Course");
    expect(screen.getByRole("tabpanel").textContent).not.toContain("Thanks letter");
    fireEvent.keyDown(tabs[1], { key: "End" });
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2], { key: "Home" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("keeps the selection across tabs, and the request carries the hidden ones too", () => {
    show([
      { id: A, title: "Course", category: "course_certificate" },
      { id: B, title: "Thanks letter", category: "thank_you_letter" },
      { id: C, title: "Photos", category: "project_photo" },
    ]);
    fireEvent.click(screen.getByLabelText("Select Course"));
    const tabs = screen.getAllByRole("tab");
    const thanks = tabs.find((tab) => tab.id.endsWith("thank_you_letter"));
    fireEvent.click(thanks!);
    expect(screen.queryByLabelText("Select Course")).toBeNull();
    fireEvent.click(screen.getByLabelText("Select Thanks letter"));
    fireEvent.click(screen.getByRole("button", { name: "Request selected documents" }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/sign-in",
      query: { redirect_url: `/en/documents?request=${A},${B}` },
    });
    fireEvent.click(tabs[0]);
    expect((screen.getByLabelText("Select Course") as HTMLInputElement).checked).toBe(true);
  });

  it("shows no tabs for a single category", () => {
    show([{ id: A, title: "Course", category: "course_certificate" }]);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("group", { name: "documentsPage.listLabel" }).textContent).toContain("Course");
  });

  it("puts no file, storage key or URL in the page, even when the row carries one", () => {
    const leaky = {
      id: A,
      title: "Course",
      category: "course_certificate" as const,
      storage_key: "documents/secret-key.pdf",
      fileUrl: "https://files.example.org/secret.pdf",
    };
    const { container } = show([leaky]);
    const html = container.innerHTML;
    expect(html).not.toContain("secret");
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/\.pdf/);
  });

  it("signed out, a request goes through sign-in and back to this page with the choice", () => {
    show([{ id: A, title: "Course", category: "course_certificate" }]);
    fireEvent.click(screen.getByRole("button", { name: "Request to view: Course" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/sign-in",
      query: { redirect_url: `/en/documents?request=${A}` },
    });
  });

  it("says so when nothing is published", () => {
    show([]);
    expect(screen.getByRole("heading", { name: "documentsPage.empty.title" })).toBeTruthy();
    expect(screen.getByText("documentsPage.empty.text")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
