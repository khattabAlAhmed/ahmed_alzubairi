// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthLink } from "./auth-link";

const auth = vi.hoisted(() => ({
  state: { isLoaded: false, isSignedIn: undefined as boolean | undefined },
}));

vi.mock("@clerk/nextjs", () => ({ useAuth: () => auth.state }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe("AuthLink", () => {
  it("offers no link while Clerk is loading", () => {
    auth.state = { isLoaded: false, isSignedIn: undefined };
    render(<AuthLink />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to sign-in when signed out", () => {
    auth.state = { isLoaded: true, isSignedIn: false };
    render(<AuthLink />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/sign-in");
  });

  it("links to the account when signed in", () => {
    auth.state = { isLoaded: true, isSignedIn: true };
    render(<AuthLink />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/account");
  });
});
