// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/services/example", search: "" }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => nav.pathname,
  // Serializes the href and the target locale the way the real Link would.
  Link: ({
    href,
    locale,
    children,
  }: {
    href: { pathname: string; query?: Record<string, string> };
    locale: string;
    children: ReactNode;
  }) => {
    const query = new URLSearchParams(href.query).toString();
    return <a href={`/${locale}${href.pathname}${query ? `?${query}` : ""}`}>{children}</a>;
  },
}));

const { LanguageFallback, LanguageFallbackProvider, LanguageSwitch, UntranslatedSwitch, switchTarget } = await import(
  "./language-switch"
);

afterEach(() => {
  cleanup();
  nav.pathname = "/services/example";
  nav.search = "";
});

const href = () => screen.getByRole("link").getAttribute("href");

describe("switchTarget", () => {
  it("keeps the page and its query without a fallback", () => {
    expect(switchTarget("/sign-in", null, { redirect_url: "/en/account" })).toEqual({
      pathname: "/sign-in",
      query: { redirect_url: "/en/account" },
    });
  });

  it("goes to the fallback set for this page, without the query", () => {
    expect(switchTarget("/services/x", { pathname: "/services/x", href: "/services" }, { a: "1" })).toEqual({
      pathname: "/services",
    });
  });

  it("ignores a fallback left by another page", () => {
    expect(switchTarget("/about", { pathname: "/services/x", href: "/services" })).toEqual({
      pathname: "/about",
      query: undefined,
    });
  });
});

describe("LanguageSwitch", () => {
  it("switches to the same page in the other language", () => {
    render(
      <LanguageFallbackProvider>
        <LanguageSwitch />
      </LanguageFallbackProvider>,
    );
    expect(href()).toBe("/ar/services/example");
  });

  it("says the page has no translation first, then offers the section's list (§6.1)", () => {
    render(
      <LanguageFallbackProvider>
        <LanguageSwitch />
        <LanguageFallback href="/services" />
      </LanguageFallbackProvider>,
    );
    const toggle = screen.getByRole("button", { name: "switchLanguageLabel" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // Focus moves into the note; its link goes to the section's list.
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "untranslated.go" }));
    expect(href()).toBe("/ar/services");
  });

  it("closes the note on Escape or Stay, with focus back on the switch", () => {
    render(
      <LanguageFallbackProvider>
        <LanguageSwitch />
        <LanguageFallback href="/services" />
      </LanguageFallbackProvider>,
    );
    const toggle = screen.getByRole("button", { name: "switchLanguageLabel" });
    fireEvent.click(toggle);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "untranslated.stay" }));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("drops the fallback once the page that set it is gone", () => {
    const { rerender } = render(
      <LanguageFallbackProvider>
        <LanguageSwitch />
        <LanguageFallback href="/services" />
      </LanguageFallbackProvider>,
    );
    act(() =>
      rerender(
        <LanguageFallbackProvider>
          <LanguageSwitch />
        </LanguageFallbackProvider>,
      ),
    );
    expect(href()).toBe("/ar/services/example");
  });

  it("works without a provider, as on the account and auth pages", () => {
    nav.pathname = "/sign-in";
    nav.search = "redirect_url=%2Fen%2Faccount";
    render(<LanguageSwitch />);
    expect(href()).toBe("/ar/sign-in?redirect_url=%2Fen%2Faccount");
  });
});

describe("UntranslatedSwitch note position", () => {
  const note = () => screen.getByRole("group", { hidden: true });

  it("keeps the page's direction on the positioned box and the other language inside", () => {
    render(<UntranslatedSwitch href="/services" initiallyOpen />);
    // dir on the positioned box would flip what end-0 means and open it off screen.
    expect(note().hasAttribute("dir")).toBe(false);
    const inner = note().firstElementChild as HTMLElement;
    expect(inner.getAttribute("dir")).toBe("rtl");
    expect(inner.getAttribute("lang")).toBe("ar");
  });

  it("opens from the end in the header and from the start in the menu", () => {
    const { unmount } = render(<UntranslatedSwitch href="/services" initiallyOpen />);
    expect(note().className).toMatch(/\bend-0\b/);
    unmount();
    render(<UntranslatedSwitch href="/services" long initiallyOpen />);
    expect(note().className).toMatch(/\bstart-0\b/);
    expect(note().className).not.toMatch(/\bend-0\b/);
  });
});

describe("UntranslatedSwitch Escape", () => {
  it("leaves focus alone when Esc is pressed elsewhere on the page", () => {
    render(
      <>
        <button type="button">elsewhere</button>
        <UntranslatedSwitch href="/services" initiallyOpen />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "elsewhere" });
    elsewhere.focus();
    fireEvent.keyDown(elsewhere, { key: "Escape" });
    expect(document.activeElement).toBe(elsewhere);
    expect(screen.getByRole("button", { name: "switchLanguageLabel" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("marks Esc handled, so a menu around it stays open", () => {
    render(<UntranslatedSwitch href="/services" initiallyOpen />);
    const notPrevented = fireEvent.keyDown(screen.getByRole("link", { name: "untranslated.go" }), { key: "Escape" });
    expect(notPrevented).toBe(false);
    const toggle = screen.getByRole("button", { name: "switchLanguageLabel" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });
});
