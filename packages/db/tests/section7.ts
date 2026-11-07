import { readFileSync } from "node:fs";

/** Reads a §7 table's column lists from project.md, so tests follow the doc itself. */
export function readSection7Columns(
  from: string,
  to: string,
): Record<string, string[]> {
  const doc = readFileSync(
    new URL("../../../docs/project.md", import.meta.url),
    "utf8",
  );
  const section = doc.slice(doc.indexOf(from), doc.indexOf(to));
  const tables: Record<string, string[]> = {};
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("| `")) continue;
    const [, name = "", columns = ""] = line
      .split("|")
      .map((cell) => cell.trim());
    const listed = [
      ...columns.replace(/\([^)]*\)/g, "").matchAll(/`([^`]+)`/g),
    ];
    tables[name.replaceAll("`", "")] = listed.flatMap(([, column = ""]) =>
      column.endsWith("_*")
        ? [column.replace("*", "ar"), column.replace("*", "en")]
        : [column],
    );
  }
  return tables;
}
