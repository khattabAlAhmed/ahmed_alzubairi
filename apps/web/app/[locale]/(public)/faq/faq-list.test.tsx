// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Faq } from "@/lib/content";
import { FaqList } from "./faq-list";

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

afterEach(cleanup);

const faq = (id: string, category: Faq["category"]): Faq => ({
  id,
  category,
  serviceId: null,
  question: `Question ${id}?`,
  answer: `Answer ${id}.`,
});

describe("FaqList", () => {
  it("groups questions by the §6.13 categories, in order, skipping empty ones", () => {
    render(<FaqList faqs={[faq("1", "account"), faq("2", "consultations"), faq("3", "account")]} />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["faqCategory.consultations", "faqCategory.account"]);
    expect(screen.getByRole("navigation").querySelectorAll("a")).toHaveLength(2);
    // One open at a time: every question shares a name, and only the first starts open.
    const details = [...document.querySelectorAll("details")];
    expect(details.every((item) => item.getAttribute("name") === "faq")).toBe(true);
    expect(details.map((item) => item.open)).toEqual([true, false, false]);
    expect(screen.getByText("Question 3?").closest("details")).toBeTruthy();
    expect(screen.getByText("Answer 3.")).toBeTruthy();
  });

  it("shows no section links for one section, and a note when empty", () => {
    render(<FaqList faqs={[faq("1", "training")]} />);
    expect(screen.queryByRole("navigation")).toBeNull();
    cleanup();

    render(<FaqList faqs={[]} />);
    expect(screen.getByText("noFaqs")).toBeTruthy();
  });
});
