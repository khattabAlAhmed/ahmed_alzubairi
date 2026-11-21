// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";

afterEach(cleanup);

const columns = [
  { key: "title", label: "Title", primary: true, sortable: true },
  { key: "client", label: "Client" },
  { key: "activity", label: "Last activity", sortable: true, numeric: true },
];
const rows = [
  { id: "a", cells: { title: "Bylaws review", client: "Layla M.", activity: "Today" }, action: <a href="#a">Open</a> },
  { id: "b", cells: { title: "Family charter", client: "Khalid A.", activity: "Yesterday" }, action: <a href="#b">Open</a> },
];
const labels = { selectAll: "Select all", selectRow: (name: string) => `Select ${name}`, actions: "Actions" };

describe("DataTable", () => {
  it("marks the sorted column and asks the caller to sort", () => {
    const onSort = vi.fn();
    render(<DataTable caption="Consultations" columns={columns} rows={rows} sort={{ key: "activity", direction: "descending" }} onSort={onSort} labels={labels} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers.find((h) => h.textContent?.includes("Last activity"))?.getAttribute("aria-sort")).toBe("descending");
    expect(headers.find((h) => h.textContent?.includes("Title"))?.getAttribute("aria-sort")).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    expect(onSort).toHaveBeenCalledWith("title");
  });

  it("selects one row or all, and marks selected rows", () => {
    const onSelect = vi.fn();
    render(<DataTable caption="Consultations" columns={columns} rows={rows} selected={new Set(["a"])} onSelect={onSelect} labels={labels} />);
    expect(screen.getByRole("checkbox", { name: "Select Bylaws review" })).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Family charter" }));
    expect(onSelect).toHaveBeenCalledWith(["b"], true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(onSelect).toHaveBeenCalledWith(["a", "b"], true);
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(second.getAttribute("aria-selected")).toBe("false");
  });

  it("stacks rows on phones and has no zebra stripes", () => {
    const { container } = render(<DataTable caption="Consultations" columns={columns} rows={rows} labels={labels} />);
    const row = container.querySelector("tbody tr");
    expect(row?.className).toContain("max-md:flex-col");
    expect(container.innerHTML).not.toMatch(/\b(odd|even):/);
  });
});
