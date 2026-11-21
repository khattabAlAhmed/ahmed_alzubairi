// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardStatistics.json";
import en from "@/messages/en/DashboardStatistics.json";
import type { KpiResult } from "./data";
import { monthWindows } from "./months";

const lang = vi.hoisted(() => ({ locale: "en" as "ar" | "en" }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "DashboardStatistics") =>
    createTranslator({ locale: lang.locale, namespace, messages: { DashboardStatistics: lang.locale === "ar" ? ar : en } }),
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const { StatisticsView } = await import("./statistics-view");

afterEach(cleanup);

const windows = monthWindows(new Date("2026-11-18T12:00:00Z"), "UTC");
const months = (last: number, before = 0) => [...Array(10).fill(0), before, last];

async function show(kpis: KpiResult[], locale: "ar" | "en" = "en") {
  lang.locale = locale;
  render(await StatisticsView({ statistics: { windows, kpis }, locale }));
}

describe("StatisticsView", () => {
  it("shows this month's value and the change since last month, with a chart", async () => {
    await show([{ key: "registrations", months: months(5, 2) }]);
    const tile = screen.getByText(en.kpis.registrations.label).parentElement!;
    expect(within(tile).getByText("5")).toBeTruthy();
    expect(within(tile).getByText("+3")).toBeTruthy();
    expect(screen.getByText(en.kpis.registrations.chart)).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("keeps an unavailable KPI's tile, says so, and draws no chart for it", async () => {
    await show([
      { key: "downloads", unavailable: true },
      { key: "signupShare", unavailable: true },
      { key: "documentRequests", months: months(1) },
    ]);
    expect(screen.getAllByText(en.unavailable)).toHaveLength(2);
    expect(screen.queryByText(en.kpis.downloads.chart)).toBeNull();
    expect(screen.queryByText(en.kpis.signupShare.chart)).toBeNull();
    expect(screen.getByText(en.kpis.documentRequests.chart)).toBeTruthy();
  });

  it("shows a chart's empty state for twelve months of nothing", async () => {
    await show([{ key: "consultations", months: Array(12).fill(0) }]);
    expect(screen.getByText(en.chart.empty)).toBeTruthy();
  });

  it("shows the newsletter total with this month's new subscribers", async () => {
    await show([{ key: "newsletter", total: 40, months: months(3) }]);
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("3 new this month")).toBeTruthy();
  });

  it("shows the reply time in hours, and says when there is none", async () => {
    await show([{ key: "firstReply", months: [...Array(11).fill(null), 14], recent: 14.25, capped: false }]);
    expect(screen.getByText("14.3")).toBeTruthy();
    expect(screen.getByText(en.kpis.firstReply.unit)).toBeTruthy();
    cleanup();
    await show([{ key: "firstReply", months: Array(12).fill(null), recent: null, capped: false }]);
    expect(screen.getByText("No request submitted in the last 90 days has a first reply yet")).toBeTruthy();
  });

  it("shows the sign-up share as a percent, with the approximate note", async () => {
    await show([{ key: "signupShare", signups: months(2), visitors: months(40) }]);
    expect(screen.getByText("5%")).toBeTruthy();
    expect(screen.getByText("2 sign-ups of 40 visitors")).toBeTruthy();
    expect(screen.getAllByText(en.approximate).length).toBeGreaterThan(0);
  });

  it("shows the approximate note under the tiles only when the visitor tile shows a share", async () => {
    const outsideCharts = () => screen.queryAllByText(en.approximate).filter((element) => !element.closest("figure"));
    await show([{ key: "signupShare", signups: months(2), visitors: months(40) }]);
    expect(outsideCharts()).toHaveLength(1);
    cleanup();
    await show([{ key: "signupShare", signups: Array(12).fill(0), visitors: Array(12).fill(0) }]);
    expect(outsideCharts()).toHaveLength(0);
    cleanup();
    // Visitors earlier, none this month: the tile says so, and the note stays in the chart.
    await show([{ key: "signupShare", signups: Array(12).fill(1), visitors: [...Array(11).fill(40), 0] }]);
    expect(screen.getByText(en.kpis.signupShare.noVisitors)).toBeTruthy();
    expect(outsideCharts()).toHaveLength(0);
    // The chart still carries the note for its earlier months.
    expect(screen.getAllByText(en.approximate).some((element) => element.closest("figure"))).toBe(true);
    cleanup();
    await show([{ key: "signupShare", unavailable: true }]);
    expect(outsideCharts()).toHaveLength(0);
  });

  it("says the reply chart may miss older months when the sample is capped", async () => {
    await show([{ key: "firstReply", months: [...Array(11).fill(null), 3], recent: 3, capped: true }]);
    expect(screen.getByText(/from the latest 5,000 replied requests/)).toBeTruthy();
    expect(screen.queryByText(/latest 5,000/, { selector: "p" })).toBeNull();
  });

  it("shows no share, not 0%, for a month with no measured visitors, and leaves such months out of the chart", async () => {
    await show([{ key: "signupShare", signups: [...Array(10).fill(0), 1, 1], visitors: [...Array(10).fill(0), 20, 0] }]);
    expect(screen.getByText(en.kpis.signupShare.noVisitors)).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(2); // header + the one month with visitors
  });

  it("speaks Arabic with Arabic month names", async () => {
    await show([{ key: "registrations", months: months(5, 2) }], "ar");
    expect(screen.getByText(ar.kpis.registrations.label)).toBeTruthy();
    expect(screen.getAllByText(/نوفمبر/).length).toBeGreaterThan(0);
  });

  it("writes the chart's ticks and values in Arabic-Indic digits in Arabic", async () => {
    await show([{ key: "registrations", months: months(5, 2) }], "ar");
    const figure = screen.getByText(ar.kpis.registrations.chart).closest("figure")!;
    const text = figure.textContent ?? "";
    expect(text).toMatch(/٥/);
    expect(text).not.toMatch(/[0-9]/);
  });
});
