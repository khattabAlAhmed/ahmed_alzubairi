// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SectionIndex } from "./section-index";

const mocks = vi.hoisted(() => ({ locale: "en" }));

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useLocale: () => mocks.locale,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { href: string; children: ReactNode }) => (
    <a data-locale-link="" {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  mocks.locale = "en";
});

describe("SectionIndex", () => {
  it("names the navigation and lists one row per item", () => {
    render(
      <SectionIndex
        label="Sections"
        items={[
          { label: "One", href: "#one" },
          { label: "Two", href: "#two" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(Array.from(nav.querySelectorAll("a")).map((link) => link.textContent)).toEqual(["One", "Two"]);
  });

  it("keeps a part of this page as a plain anchor and gives a page the locale link", () => {
    render(
      <SectionIndex
        label="Index"
        items={[
          { label: "Here", href: "#here" },
          { label: "Terms", href: "/terms" },
        ]}
      />,
    );
    const [here, terms] = screen.getAllByRole("link");
    expect(here?.getAttribute("href")).toBe("#here");
    expect(here?.hasAttribute("data-locale-link")).toBe(false);
    expect(terms?.getAttribute("href")).toBe("/terms");
    expect(terms?.hasAttribute("data-locale-link")).toBe(true);
  });

  it("marks only the current row, as the page or as the place on it", () => {
    render(
      <SectionIndex
        label="Index"
        items={[
          { label: "Privacy", href: "/privacy", current: true },
          { label: "Terms", href: "/terms" },
          { label: "Part", href: "#part", current: true },
        ]}
      />,
    );
    const [privacy, terms, part] = screen.getAllByRole("link");
    expect(privacy?.getAttribute("aria-current")).toBe("page");
    expect(terms?.hasAttribute("aria-current")).toBe(false);
    expect(part?.getAttribute("aria-current")).toBe("true");
  });

  it("shows a count in the reader's digits only when one is given", () => {
    mocks.locale = "ar";
    render(
      <SectionIndex
        label="Index"
        items={[
          { label: "With", href: "#with", count: 12 },
          { label: "Without", href: "#without" },
        ]}
      />,
    );
    const [withCount, without] = screen.getAllByRole("link");
    expect(withCount?.textContent).toBe("With١٢");
    expect(without?.textContent).toBe("Without");
  });

  it("opens with the heavy rule and takes the caller's placement", () => {
    render(<SectionIndex label="Index" items={[]} className="lg:col-span-3" />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("border-t-2");
    expect(nav.className).toContain("lg:col-span-3");
  });
});
