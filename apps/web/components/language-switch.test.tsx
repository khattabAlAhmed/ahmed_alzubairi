// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
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

const { LanguageFallback, LanguageFallbackProvider, LanguageSwitch, switchTarget } = await import(
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

  it("goes to the section's list when the page has no translation (§6.1)", () => {
    render(
      <LanguageFallbackProvider>
        <LanguageSwitch />
        <LanguageFallback href="/services" />
      </LanguageFallbackProvider>,
    );
    expect(href()).toBe("/ar/services");
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
