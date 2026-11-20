// @vitest-environment jsdom
import type { NewsletterSubscriber } from "@repo/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTime } from "@/lib/time/format";
import ar from "@/messages/ar/DashboardNewsletter.json";
import en from "@/messages/en/DashboardNewsletter.json";
import { SubscriberList } from "./subscriber-list";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));

const { exportPath, newsletterPath, parseNewsletterParams } = await import("./data");

const MESSAGES = { ar, en };

const row = (rest: Partial<NewsletterSubscriber> = {}): NewsletterSubscriber => ({
  id: "123e4567-e89b-42d3-a456-426614174000",
  email: "reader@example.com",
  locale: "ar",
  status: "confirmed",
  source: "footer",
  consentedAt: "2026-11-01T08:00:00.000Z",
  createdAt: "2026-11-01T07:59:00.000Z",
  ...rest,
});

afterEach(cleanup);

function show(subscribers: NewsletterSubscriber[], locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ DashboardNewsletter: MESSAGES[locale] }}>
      <SubscriberList subscribers={subscribers} />
    </NextIntlClientProvider>,
  );
}

describe("SubscriberList", () => {
  it.each(["ar", "en"] as const)("shows each row's email, status, source, language and dates in %s", (locale) => {
    const m = MESSAGES[locale];
    show(
      [
        row(),
        row({ id: "2", email: "p@example.com", status: "pending", source: "blog", locale: "en", consentedAt: null }),
        row({ id: "3", email: "u@example.com", status: "unsubscribed", source: "resource" }),
      ],
      locale,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    const first = within(items[0]!);
    expect(first.getByText("reader@example.com").getAttribute("dir")).toBe("ltr");
    expect(first.getByText(m.statuses.confirmed)).toBeTruthy();
    expect(first.getByText(m.sources.footer)).toBeTruthy();
    expect(first.getByText(m.languages.ar)).toBeTruthy();
    // Dates are formatted with Intl, in the viewer's language.
    const times = items[0]!.querySelectorAll("time");
    expect(times).toHaveLength(2);
    expect(times[0]?.getAttribute("datetime")).toBe("2026-11-01T07:59:00.000Z");
    expect(times[0]?.textContent).toBe(formatDateTime("2026-11-01T07:59:00.000Z", locale));
    // Arabic-Indic digits in Arabic (DESIGN.md "Numbers").
    expect(times[0]?.textContent).toMatch(locale === "ar" ? /٢٠٢٦/ : /2026/);
    expect(within(items[1]!).getByText(m.statuses.pending)).toBeTruthy();
    expect(within(items[1]!).getByText(m.row.none)).toBeTruthy();
    expect(within(items[2]!).getByText(m.statuses.unsubscribed)).toBeTruthy();
  });

  it("renders an address as text, never as markup", () => {
    show([row({ email: '<img src=x onerror="alert(1)">@example.com' })]);
    expect(document.querySelector("img")).toBeNull();
  });

  it("has the same keys in both languages", () => {
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" ? keys(inner as object, `${prefix}${key}.`) : `${prefix}${key}`,
      );
    expect(keys(ar)).toEqual(keys(en));
  });
});

describe("list params and paths", () => {
  it("keeps the known values and drops the ones the schema refuses", () => {
    expect(
      parseNewsletterParams({ page: "3", status: "confirmed", search: " a@b ", pageSize: "50", extra: "x" }),
    ).toEqual({ page: 3, pageSize: 50, status: "confirmed", search: "a@b" });
    expect(parseNewsletterParams({ page: "0", status: "bounced", pageSize: "1000" })).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(parseNewsletterParams({ status: ["pending", "confirmed"], search: "" })).toEqual({
      page: 1,
      pageSize: 20,
      status: "pending",
    });
  });

  it("builds the list's address without defaults", () => {
    expect(newsletterPath({})).toBe("/dashboard/newsletter");
    expect(newsletterPath({ page: 1, pageSize: 20 })).toBe("/dashboard/newsletter");
    expect(newsletterPath({ page: 2, status: "pending", search: "a b&c" })).toBe(
      "/dashboard/newsletter?search=a+b%26c&status=pending&page=2",
    );
  });

  it("the export's address carries the search only, never the status or the page", () => {
    expect(exportPath()).toBe("/api/admin/newsletter/export");
    expect(exportPath("a&status=pending")).toBe(
      "/api/admin/newsletter/export?search=a%26status%3Dpending",
    );
  });
});
