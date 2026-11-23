// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FooterNewsletterSlot } from "./footer-newsletter-slot";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => nav.pathname }));

afterEach(cleanup);

describe("FooterNewsletterSlot", () => {
  it("leaves the footer signup out on home, which has its own", () => {
    nav.pathname = "/";
    render(<FooterNewsletterSlot><form aria-label="Newsletter" /></FooterNewsletterSlot>);
    expect(screen.queryByRole("form")).toBeNull();
  });

  it.each(["/about", "/services/governance-review", "/blog"])("shows it on %s", (pathname) => {
    nav.pathname = pathname;
    render(<FooterNewsletterSlot><form aria-label="Newsletter" /></FooterNewsletterSlot>);
    expect(screen.getByRole("form", { name: "Newsletter" })).toBeTruthy();
  });
});
