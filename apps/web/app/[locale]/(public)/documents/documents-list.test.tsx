// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentsList } from "./documents-list";

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    "aria-label": label,
  }: {
    href: { pathname: string; query: Record<string, string> };
    children: ReactNode;
    "aria-label"?: string;
  }) => (
    <a href={`${href.pathname}?${new URLSearchParams(href.query)}`} aria-label={label}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("DocumentsList", () => {
  it("groups titles by category in the shared order, each with a request link", () => {
    render(
      <DocumentsList
        documents={[
          { id: "d2", title: "Thanks letter", category: "thank_you_letter" },
          { id: "d1", title: "Course", category: "course_certificate" },
        ]}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["documentCategory.course_certificate", "documentCategory.thank_you_letter"]);
    const link = screen.getByRole("link", { name: 'requestAccessLabel:{"title":"Course"}' });
    expect(link.getAttribute("href")).toBe("/account/documents?document=d1");
    expect(link.textContent).toBe("requestAccess");
  });

  it("says so when nothing is published", () => {
    render(<DocumentsList documents={[]} />);
    expect(screen.getByText("noDocuments")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
