// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/dashboard/content" }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => nav.pathname,
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { DashboardNavLink } = await import("./dashboard-nav-link");
const { DashboardNavMenu } = await import("./dashboard-nav-menu");

const ITEMS = [
  { key: "home", href: "/dashboard", label: "Overview", exact: true },
  { key: "content", href: "/dashboard/content", label: "Content", exact: false },
  { key: "settings", href: "/dashboard/settings", label: "Settings", exact: false },
];

function Menu() {
  return (
    <DashboardNavMenu label="Dashboard menu">
      {ITEMS.map((item) => (
        <li key={item.key}>
          <DashboardNavLink href={item.href} exact={item.exact}>
            {item.label}
          </DashboardNavLink>
        </li>
      ))}
    </DashboardNavMenu>
  );
}

afterEach(() => {
  cleanup();
  nav.pathname = "/dashboard/content";
});

const button = () => screen.getByRole("button");
const list = () => document.getElementById(button().getAttribute("aria-controls") ?? "");

describe("DashboardNavMenu", () => {
  it("names the menu and the current section on the button", () => {
    render(<Menu />);
    expect(button().textContent).toBe("Dashboard menu: Content");
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("falls back to the menu name when no entry is current", () => {
    nav.pathname = "/dashboard/unknown";
    render(<Menu />);
    expect(button().textContent).toBe("Dashboard menu: Dashboard menu");
  });

  it("marks only the current page, and the overview only on its own page", () => {
    render(<Menu />);
    const current = screen.getAllByRole("link", { hidden: true }).filter((link) => link.getAttribute("aria-current"));
    expect(current.map((link) => link.textContent)).toEqual(["Content"]);
  });

  it("opens the list, closes on Escape and returns focus to the button", () => {
    render(<Menu />);
    expect(list()?.className).toContain("hidden");
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(list()?.className).not.toMatch(/(^| )hidden( |$)/);

    screen.getByRole("link", { name: "Settings" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button());
  });

  it("closes after choosing an entry", () => {
    render(<Menu />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on a new page", () => {
    const { rerender } = render(<Menu />);
    fireEvent.click(button());
    nav.pathname = "/dashboard/settings";
    rerender(<Menu />);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(button().textContent).toBe("Dashboard menu: Settings");
  });

  it("closes on a click outside, but not on a click inside", () => {
    render(
      <>
        <Menu />
        <p>Page</p>
      </>,
    );
    fireEvent.click(button());
    fireEvent.pointerDown(list() as HTMLElement);
    expect(button().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(screen.getByText("Page"));
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("puts the focus ring on every entry", () => {
    render(<Menu />);
    for (const link of screen.getAllByRole("link", { hidden: true })) {
      expect(link.className).toContain("focus-visible:outline-ring");
    }
  });
});
