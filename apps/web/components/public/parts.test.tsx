// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoreLink } from "./parts";

const intl = vi.hoisted(() => ({ locale: "en" }));

vi.mock("next-intl", () => ({
  useLocale: () => intl.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("MoreLink", () => {
  it("joins the label and the count with a middle dot in English", () => {
    intl.locale = "en";
    render(<MoreLink href="/projects" label="All projects" count="38" />);
    expect(screen.getByRole("link").textContent).toBe("All projects · 38");
  });

  it("joins them with an em dash in Arabic, so the dot never reads as a zero", () => {
    intl.locale = "ar";
    render(<MoreLink href="/projects" label="كل المشاريع" count="٣٨" />);
    const text = screen.getByRole("link").textContent;
    expect(text).toBe("كل المشاريع — ٣٨");
    expect(text).not.toContain("·");
  });

  it("shows the label alone without a count", () => {
    intl.locale = "ar";
    render(<MoreLink href="/services" label="كل الخدمات" back />);
    expect(screen.getByRole("link").textContent).toBe("كل الخدمات");
  });
});
