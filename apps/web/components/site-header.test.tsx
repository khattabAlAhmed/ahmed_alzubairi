// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAIN_NAV, MENU_NAV } from "./nav-items";

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/content", () => ({ getSiteSettings: async () => null }));
vi.mock("./auth-link", () => ({ AuthLink: () => null }));
vi.mock("./consultation-button", () => ({ ConsultationButton: () => <button type="button">consult</button> }));
vi.mock("./language-switch", () => ({ LanguageSwitch: () => null }));
vi.mock("./theme-switch", () => ({ ThemeSwitch: () => null }));
vi.mock("./site-logo", () => ({
  SiteLogo: ({ className }: { className?: string }) => (
    <span data-testid="logo" className={className}>
      logo
    </span>
  ),
}));
vi.mock("./quick-contact", () => ({ QuickContact: () => null }));
vi.mock("./nav-link", () => ({
  NavLink: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { SiteHeader } = await import("./site-header");

afterEach(cleanup);

/** The responsive classes on an element, e.g. ["hidden", "2xl:block"]. */
const classes = (element: Element | null) => (element?.getAttribute("class") ?? "").split(/\s+/);

describe("SiteHeader", () => {
  it("shows the inline nav from 1440 px, where the menu button hides", () => {
    render(<SiteHeader />);
    const header = screen.getByRole("banner");
    const [inline] = within(header).getAllByRole("navigation", { name: "mainLabel" });
    expect(classes(inline)).toEqual(expect.arrayContaining(["hidden", "min-[90rem]:flex"]));

    const menuButton = within(header).getByRole("button", { name: "openMenu" });
    expect(classes(menuButton.parentElement)).toContain("min-[90rem]:hidden");
  });

  it("stays at the top while the page scrolls, opened by the 2px rule", () => {
    render(<SiteHeader />);
    expect(classes(screen.getByRole("banner"))).toEqual(expect.arrayContaining(["sticky", "top-0", "border-t-2"]));
  });

  it("lists the Header board's sections inline and the MobileMenu board's in the menu", () => {
    render(<SiteHeader />);
    const header = screen.getByRole("banner");
    // The menu panel is hidden until opened; its links are there either way.
    const [inline, menu] = within(header).getAllByRole("navigation", { name: "mainLabel", hidden: true });
    const hrefs = (nav: HTMLElement | undefined) =>
      within(nav!).getAllByRole("link", { hidden: true }).map((link) => link.getAttribute("href"));
    expect(hrefs(inline)).toEqual(MAIN_NAV.map((item) => item.href));
    expect(hrefs(menu)).toEqual(MENU_NAV.map((item) => item.href));
  });

  it("always shows «اطلب استشارة», even on phones", () => {
    render(<SiteHeader />);
    const consult = within(screen.getByRole("banner")).getAllByRole("button", { name: "consult" })[0];
    expect(consult?.closest(".hidden")).toBeNull();
  });

  it("keeps the site name on one line", () => {
    render(<SiteHeader />);
    // SiteLogo's first span is the name; the fields line under it may wrap.
    expect(classes(within(screen.getByRole("banner")).getByTestId("logo"))).toContain("[&>span:first-child]:whitespace-nowrap");
  });
});
