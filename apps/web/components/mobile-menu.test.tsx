// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileMenu, trapTab } from "./mobile-menu";
import { MENU_NAV } from "./nav-items";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./nav-link", () => ({
  NavLink: ({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock("./language-switch", () => ({ LanguageSwitch: () => <button type="button">language</button> }));
vi.mock("./theme-switch", () => ({ ThemeSwitch: () => <button type="button">theme</button> }));
vi.mock("./consultation-button", () => ({ ConsultationButton: () => <button type="button">consult</button> }));

afterEach(cleanup);

const open = () => {
  const button = screen.getByRole("button", { name: "openMenu" });
  fireEvent.click(button);
  return button;
};

describe("MobileMenu", () => {
  it("opens as a labelled modal dialog with the board's index of sections", () => {
    render(<MobileMenu />);
    const button = open();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: "menuLabel" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const links = within(within(dialog).getByRole("navigation")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(MENU_NAV.map((item) => item.href));
    // Language, theme and the consultation button sit under the index.
    expect(within(dialog).getByRole("button", { name: "consult" })).toBeTruthy();
  });

  it("puts focus on the close button when it opens", () => {
    render(<MobileMenu />);
    open();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "closeMenu" }));
  });

  it("closes on Escape and gives focus back to its button", () => {
    render(<MobileMenu />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    const button = screen.getByRole("button", { name: "openMenu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes from its close button, giving focus back", () => {
    render(<MobileMenu />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "closeMenu" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "openMenu" }));
  });

  it("keeps Tab inside the panel: from the last control to the first, and back", () => {
    render(<MobileMenu />);
    open();
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "closeMenu" });
    const last = within(dialog).getByRole("button", { name: "consult" });

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe("trapTab", () => {
  it("leaves other keys alone", () => {
    const panel = document.createElement("div");
    const preventDefault = vi.fn();
    expect(trapTab(panel, { key: "Enter", shiftKey: false, preventDefault })).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
