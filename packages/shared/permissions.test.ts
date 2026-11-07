import { describe, expect, it } from "vitest";
import projectDoc from "../../docs/project.md?raw";
import {
  PERMISSIONS,
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  type Permission,
  type RoleKey,
} from "./permissions";

const ROLE_COLUMNS: Record<string, RoleKey> = {
  المدير: "admin",
  "مستشار مساعد": "assistant_consultant",
  "محرر محتوى": "content_editor",
  "منسق تدريب": "training_coordinator",
};

const cellsOf = (row: string) =>
  row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

/** Reads the §5 table from project.md, so the test follows the doc itself. */
function readSection5Table() {
  const section = projectDoc.slice(
    projectDoc.indexOf("## 5. Roles and permissions"),
    projectDoc.indexOf("## 6. Features"),
  );
  const lines = section.split(/\r?\n/);
  const header = lines.find((line) => line.startsWith("| Permission key"));
  if (!header) throw new Error("§5 table header not found");

  const roles = cellsOf(header)
    .slice(2)
    .map((name) => {
      const role = ROLE_COLUMNS[name];
      if (!role) throw new Error(`Unknown §5 role column: ${name}`);
      return role;
    });

  const rows = lines
    .filter((line) => line.startsWith("| `"))
    .map((line) => {
      const cells = cellsOf(line);
      return {
        key: (cells[0] ?? "").replaceAll("`", "") as Permission,
        marks: cells.slice(2),
      };
    });

  return { roles, rows };
}

describe("PERMISSIONS", () => {
  const { rows } = readSection5Table();

  it("has exactly the 14 keys of §5", () => {
    expect(Object.values(PERMISSIONS)).toHaveLength(14);
    expect(Object.values(PERMISSIONS).toSorted()).toEqual(
      rows.map((row) => row.key).toSorted(),
    );
  });

  it("has no duplicate key", () => {
    const values = Object.values(PERMISSIONS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("ROLE_PERMISSIONS", () => {
  const { roles, rows } = readSection5Table();

  it("covers every role column of §5", () => {
    expect(roles.toSorted()).toEqual([...ROLE_KEYS].toSorted());
    expect(Object.keys(ROLE_PERMISSIONS).toSorted()).toEqual(
      [...ROLE_KEYS].toSorted(),
    );
  });

  it("reads a ✅ or ❌ in every cell of §5", () => {
    expect(rows).toHaveLength(14);
    for (const { marks } of rows) {
      expect(marks).toHaveLength(roles.length);
      for (const mark of marks) expect(["✅", "❌"]).toContain(mark);
    }
  });

  it.each(
    rows.flatMap(({ key, marks }) =>
      roles.map((role, column) => ({
        role,
        key,
        allowed: marks[column] === "✅",
      })),
    ),
  )("$role / $key is $allowed, as in §5", ({ role, key, allowed }) => {
    expect(ROLE_PERMISSIONS[role].includes(key)).toBe(allowed);
  });

  it("refuses the admin-only keys to every other role", () => {
    for (const role of ROLE_KEYS.filter((key) => key !== "admin")) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(
        PERMISSIONS.DOCUMENT_REQUESTS_DECIDE,
      );
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.TEAM_MANAGE);
    }
  });
});
