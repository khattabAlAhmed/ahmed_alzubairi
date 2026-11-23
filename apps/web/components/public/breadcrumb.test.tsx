// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Pages.json";
import en from "@/messages/en/Pages.json";
import { Breadcrumb } from "./breadcrumb";

const intl = vi.hoisted(() => ({ locale: "en" as "ar" | "en" }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: "breadcrumbLabel") => (intl.locale === "ar" ? ar : en)[key],
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe.each([
  ["en", "Breadcrumb", "Services", "Institutional governance"],
  ["ar", "المسار", "الخدمات", "الحوكمة المؤسسية"],
] as const)("Breadcrumb in %s", (locale, navLabel, section, page) => {
  function renderCrumbs() {
    intl.locale = locale;
    render(
      <div dir={locale === "ar" ? "rtl" : "ltr"}>
        <Breadcrumb items={[{ label: section, href: "/services" }, { label: page }]} />
      </div>,
    );
  }

  it("is a navigation landmark with its own label", () => {
    renderCrumbs();
    expect(screen.getByRole("navigation", { name: navLabel })).toBeTruthy();
  });

  it("lists the steps in order, the section as a link and the page as current", () => {
    renderCrumbs();
    const list = within(screen.getByRole("navigation")).getByRole("list");
    expect(list.tagName).toBe("OL");
    const link = within(list).getByRole("link", { name: section });
    expect(link.getAttribute("href")).toBe("/services");
    const current = within(list).getByText(page);
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.closest("a")).toBeNull();
    // The slash is decoration: screen readers hear the two steps only.
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([section, page]);
  });

  it("reaches the section link with Tab", async () => {
    renderCrumbs();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: section }));
  });
});

it("renders nothing without steps", () => {
  const { container } = render(<Breadcrumb items={[]} />);
  expect(container.innerHTML).toBe("");
});
