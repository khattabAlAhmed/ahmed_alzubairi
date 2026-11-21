// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentBanner } from "../consent-banner";
import arConsent from "../../messages/ar/Consent.json";
import enConsent from "../../messages/en/Consent.json";
import { MonthlyChart, niceScale } from "./monthly-chart";
import { StatTile } from "./stat-tile";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("StatTile", () => {
  it("shows the value, unit, hint and change", () => {
    render(
      <StatTile
        label="Requests"
        value="38"
        unit="per month"
        hint="New requests"
        change={{ direction: "up", tone: "better", value: "+31%", label: "vs last month" }}
      />,
    );
    expect(screen.getByText("38")).toBeTruthy();
    expect(screen.getByText("per month")).toBeTruthy();
    expect(screen.getByText("New requests")).toBeTruthy();
    expect(screen.getByText("+31%").closest("p")?.className).toContain("text-ink");
    expect(screen.getByText("vs last month")).toBeTruthy();
  });

  it("shows a bad change in the danger color, with its text", () => {
    render(<StatTile label="Signups" value="4%" change={{ direction: "down", tone: "worse", value: "-8%", label: "vs last month" }} />);
    expect(screen.getByText("-8%").closest("p")?.className).toContain("text-danger");
  });

  it("loading: keeps the label, hides the value, announces the status", () => {
    const { container } = render(<StatTile label="Requests" value="38" state="loading" loadingLabel="Loading…" />);
    expect(screen.getByText("Requests")).toBeTruthy();
    expect(screen.queryByText("38")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });

  it("unavailable: says so instead of showing a value", () => {
    render(<StatTile label="Requests" value="0" state="unavailable" unavailableLabel="Not available right now" />);
    expect(screen.getByText("Not available right now")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("StatTile as a link", () => {
  it("is one link named by its label and value", () => {
    render(<StatTile href="/dashboard/consultations" label="Open consultations" value="17" />);
    const link = screen.getByRole("link", { name: "Open consultations 17" });
    expect(link.getAttribute("href")).toBe("/dashboard/consultations");
  });

  it("is no link while loading or unavailable", () => {
    render(<StatTile href="/dashboard" label="" state="loading" />);
    render(<StatTile href="/dashboard" label="Open consultations" state="unavailable" unavailableLabel="Not available" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps a label line while loading without a label", () => {
    const { container } = render(<StatTile label="" state="loading" />);
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(3);
  });
});

describe("niceScale", () => {
  it("rounds the top up to a clean step", () => {
    expect(niceScale(38)).toEqual({ top: 40, ticks: [0, 10, 20, 30, 40] });
    expect(niceScale(1284)).toEqual({ top: 1500, ticks: [0, 500, 1000, 1500] });
  });

  it("keeps whole-number steps for small counts", () => {
    expect(niceScale(2).ticks).toEqual([0, 1, 2]);
  });

  it("handles all zeros", () => {
    expect(niceScale(0)).toEqual({ top: 1, ticks: [0, 1] });
  });
});

describe("MonthlyChart", () => {
  const props = { title: "Requests", locale: "en", monthHeader: "Month", valueHeader: "Requests", emptyLabel: "No data yet.", tableToggleLabel: "Show values" };

  it("gives screen readers a table of every month", () => {
    const data = ["Jan", "Feb", "Mar"].map((label, index) => ({ label, value: (index + 1) * 1000 }));
    render(<MonthlyChart {...props} data={data} />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[3]).getByRole("rowheader").textContent).toBe("Mar");
    expect(within(rows[3]).getByRole("cell").textContent).toBe("3,000");
  });

  it("shows the table on a button press, for keyboard and touch users", () => {
    render(<MonthlyChart {...props} data={[{ label: "Jan", value: 20 }, { label: "Feb", value: 40 }]} />);
    const toggle = screen.getByRole("button", { name: "Show values" });
    expect(screen.getByRole("table").className).toBe("sr-only");
    expect(toggle.getAttribute("aria-controls")).toBe(screen.getByRole("table").id);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("table").className).not.toContain("sr-only");
  });

  it("hides the drawn plot from screen readers", () => {
    const { container } = render(<MonthlyChart {...props} data={[{ label: "Jan", value: 4 }]} />);
    expect(container.querySelector("[aria-hidden='true'] ol")).not.toBeNull();
  });

  it("scales bars to the top tick", () => {
    const { container } = render(
      <MonthlyChart {...props} data={[{ label: "Jan", value: 20 }, { label: "Feb", value: 40 }]} />,
    );
    const bars = container.querySelectorAll<HTMLElement>("li > span:first-child");
    expect([...bars].map((bar) => bar.style.height)).toEqual(["50%", "100%"]);
  });

  it("empty: shows the empty message and no table", () => {
    render(<MonthlyChart {...props} data={[]} />);
    expect(screen.getByText("No data yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("ConsentBanner", () => {
  function renderBanner(locale: "ar" | "en", open = true) {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const messages = { Consent: locale === "ar" ? arConsent : enConsent };
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ConsentBanner open={open} onAccept={onAccept} onDecline={onDecline} privacyHref="/privacy" />
      </NextIntlClientProvider>,
    );
    return { onAccept, onDecline };
  }

  it("is a labelled region, not a modal dialog", () => {
    renderBanner("en");
    expect(screen.getByRole("region", { name: "Privacy" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives accept and decline the same style", () => {
    renderBanner("en");
    const accept = screen.getByRole("button", { name: "Agree" });
    const decline = screen.getByRole("button", { name: "No, thanks" });
    expect(accept.className).toBe(decline.className);
    expect(accept.className).not.toContain("text-accent");
  });

  it("calls the handlers", () => {
    const { onAccept, onDecline } = renderBanner("en");
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    fireEvent.click(screen.getByRole("button", { name: "No, thanks" }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it("links to the privacy page, in Arabic too", () => {
    renderBanner("ar");
    expect(screen.getByRole("link", { name: "سياسة الخصوصية" }).getAttribute("href")).toBe("/privacy");
  });

  it("renders nothing when closed", () => {
    renderBanner("en", false);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
