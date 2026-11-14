// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import enDialog from "@/messages/en/DocumentRequestDialog.json";
import { DocumentsList } from "./documents-list";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: false }) }));
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

describe("DocumentsList", () => {
  it("groups titles by category in the shared order, each with a request button and a box", () => {
    show([
      { id: B, title: "Thanks letter", category: "thank_you_letter" },
      { id: A, title: "Course", category: "course_certificate" },
    ]);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["documentCategory.course_certificate", "documentCategory.thank_you_letter"]);
    expect(screen.getByRole("button", { name: "Request to view: Course" }).textContent).toBe("Request to view");
    expect(screen.getByLabelText("Select Thanks letter")).toBeTruthy();
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
    expect(screen.getByText("noDocuments")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
