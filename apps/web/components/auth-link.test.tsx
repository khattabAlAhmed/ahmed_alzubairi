// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOT_LOADED, onClerkRequest, publishAuth, readAuth, resetAuthStateForTests } from "@/components/clerk/auth-state";
import { AuthLink } from "./auth-link";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  resetAuthStateForTests();
});

describe("AuthLink", () => {
  it("links to sign-in before Clerk loads: the safe choice for everyone", () => {
    render(<AuthLink />);
    expect(screen.getByRole("link", { name: "signIn" }).getAttribute("href")).toBe("/sign-in");
  });

  it("links to sign-in when signed out", () => {
    render(<AuthLink />);
    act(() => publishAuth({ isLoaded: true, isSignedIn: false, email: null }));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/sign-in");
  });

  it("switches to the account once Clerk says the visitor is signed in", () => {
    render(<AuthLink />);
    act(() => publishAuth({ isLoaded: true, isSignedIn: true, email: "a@example.com" }));
    expect(screen.getByRole("link", { name: "account" }).getAttribute("href")).toBe("/account");
  });

  it("asks for Clerk when pointed at or focused", () => {
    const requested = vi.fn();
    onClerkRequest(requested);
    render(<AuthLink />);
    fireEvent.pointerEnter(screen.getByRole("link"));
    fireEvent.focus(screen.getByRole("link"));
    expect(requested).toHaveBeenCalledTimes(2);
  });

  describe("signedInAs (design-system page only)", () => {
    const links = () => {
      const [real, shown] = screen.getAllByRole("link");
      return { real, shown };
    };

    it("draws the signed-in link while the store is signed out, and the real link stays signed out", () => {
      render(
        <>
          <AuthLink />
          <AuthLink signedInAs="sara@example.org" />
        </>,
      );
      act(() => publishAuth({ isLoaded: true, isSignedIn: false, email: null }));
      const { real, shown } = links();
      expect(real.getAttribute("href")).toBe("/sign-in");
      expect(real.textContent).toBe("signIn");
      expect(shown.getAttribute("href")).toBe("/account");
      expect(shown.textContent).toBe("Saccount");
    });

    it("ignores a signed-in store, while the real link follows it", () => {
      render(
        <>
          <AuthLink />
          <AuthLink signedInAs="sara@example.org" />
        </>,
      );
      act(() => publishAuth({ isLoaded: true, isSignedIn: true, email: "omar@example.org" }));
      const { real, shown } = links();
      expect(real.textContent).toBe("Oaccount");
      expect(shown.textContent).toBe("Saccount");
    });

    it("never writes to the store: it grants nothing", () => {
      render(<AuthLink signedInAs="sara@example.org" />);
      expect(readAuth()).toEqual(NOT_LOADED);
    });
  });
});
