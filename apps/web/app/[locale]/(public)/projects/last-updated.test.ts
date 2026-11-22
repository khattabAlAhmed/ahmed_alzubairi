import { describe, expect, it } from "vitest";
import { lastUpdated } from "./last-updated";

describe("lastUpdated", () => {
  it("shows the newest edit as month and year", () => {
    const projects = [{ updatedAt: "2026-01-04T10:00:00Z" }, { updatedAt: "2026-03-31T23:30:00Z" }];
    expect(lastUpdated(projects, "en")).toBe("March 2026");
    expect(lastUpdated(projects, "ar")).toBe("مارس ٢٠٢٦");
  });

  it("is null with no projects or no valid dates", () => {
    expect(lastUpdated([], "en")).toBeNull();
    expect(lastUpdated([{ updatedAt: "not a date" }], "en")).toBeNull();
  });
});
