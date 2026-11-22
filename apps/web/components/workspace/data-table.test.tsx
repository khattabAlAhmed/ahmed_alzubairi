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

  it("keeps select all and the sort buttons visible on phones, hiding only plain labels", () => {
    const { container } = render(
      <DataTable caption="Consultations" columns={columns} rows={rows} sort={{ key: "title", direction: "ascending" }} onSort={vi.fn()} selected={new Set()} onSelect={vi.fn()} labels={labels} />,
    );
    expect(container.querySelector("thead")?.className).not.toContain("sr-only");
    const headers = screen.getAllByRole("columnheader");
    const header = (text: string) => headers.find((h) => h.textContent === text)?.className ?? "";
    expect(header("Title")).not.toContain("sr-only");
    expect(header("Last activity")).not.toContain("sr-only");
    expect(header("Client")).toContain("max-md:sr-only");
    expect(screen.getByRole("checkbox", { name: "Select all" }).closest("th")?.className).not.toContain("sr-only");
  });

  it("hides the phone header when it holds no control", () => {
    const { container } = render(<DataTable caption="Consultations" columns={columns} rows={rows} labels={labels} />);
    expect(container.querySelector("thead")?.className).toContain("max-md:sr-only");
  });

  it("stacks rows on phones and has no zebra stripes", () => {
    const { container } = render(<DataTable caption="Consultations" columns={columns} rows={rows} labels={labels} />);
    const row = container.querySelector("tbody tr");
    expect(row?.className).toContain("max-md:flex-col");
    expect(container.innerHTML).not.toMatch(/\b(odd|even):/);
  });

  it("shows one quiet loading line under the header, and no rows, while loading", () => {
    const { container } = render(<DataTable caption="Consultations" columns={columns} rows={rows} labels={labels} loading="Loading consultations…" />);
    expect(screen.getByRole("status").textContent).toBe("Loading consultations…");
    expect(container.querySelector("table")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bylaws review")).toBeNull();
    const cell = container.querySelector("tbody td");
    // Spans every header cell, the action column included.
    expect(cell?.getAttribute("colspan")).toBe(String(container.querySelectorAll("thead th").length));
    expect(container.innerHTML).not.toMatch(/animate-/);
  });

  it("shows the empty record instead of the table when there are no rows", () => {
    const { container } = render(
      <DataTable
        caption="Consultations"
        columns={columns}
        rows={[]}
        labels={labels}
        empty={{ title: "No consultations yet", text: "New requests appear here.", action: <a href="#new">New request</a> }}
      />,
    );
    expect(container.querySelector("table")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "No consultations yet" })).toBeTruthy();
    expect(screen.getByText("New requests appear here.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "New request" })).toBeTruthy();
  });

  it("shows the table, not the empty record, when there are rows", () => {
    render(<DataTable caption="Consultations" columns={columns} rows={rows} labels={labels} empty={{ title: "No consultations yet", text: "…" }} />);
    expect(screen.queryByText("No consultations yet")).toBeNull();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("renders as before for callers that pass neither prop, even with no rows", () => {
    const { container } = render(<DataTable caption="Consultations" columns={columns} rows={[]} labels={labels} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("table")?.hasAttribute("aria-busy")).toBe(false);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
