import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// CLAUDE.md and §13 rules, checked on every file in components/ui.
const dir = __dirname;
const sources = readdirSync(dir)
  .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
  .map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") }));

describe("components/ui rules", () => {
  it("uses logical direction utilities only", () => {
    const physical = /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right)-[\w./[\]-]+|text-(?:left|right)|rounded-[lr](?:-|\b)|border-[lr](?:-|\b))/;
    for (const { file, text } of sources) {
      expect(text.match(physical)?.[0], file).toBeUndefined();
    }
  });

  it("uses tokens, not raw colors", () => {
    const raw = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|\b(?:bg|text|border|outline|fill|stroke|accent)-(?:red|blue|green|gray|slate|zinc|neutral|stone|amber|yellow|orange|white|black)\b/i;
    for (const { file, text } of sources) {
      expect(text.match(raw)?.[0], file).toBeUndefined();
    }
  });

  it("has no UI text: no Arabic or English sentences in JSX", () => {
    for (const { file, text } of sources) {
      expect(text.match(/[؀-ۿ]/)?.[0], file).toBeUndefined();
      // Text between JSX tags, such as <span>Loading</span>.
      expect(text.match(/>\s*[A-Za-z][A-Za-z ]{2,}\s*</)?.[0], file).toBeUndefined();
    }
  });
});
