import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every page under these folders must call its gate with its own path. A layout
// can't do it: it doesn't run again when the user moves between its pages.
const AREAS = [
  { folder: "account", gate: "requireProfile" },
  { folder: "dashboard", gate: "requireTeamMember" },
];

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

const root = join(import.meta.dirname, "[locale]");

describe.each(AREAS)("$folder pages", ({ folder, gate }) => {
  const files = pages(join(root, folder));

  it("exist", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [file.slice(root.length)]))(
    "%s calls the gate with its own path",
    (relative) => {
      const source = readFileSync(join(root, relative), "utf8");
      const page = relative.replace(/\/page\.tsx$/, "") || "/";
      expect(source).toContain(`await ${gate}(params, "${page}")`);
    },
  );
});
