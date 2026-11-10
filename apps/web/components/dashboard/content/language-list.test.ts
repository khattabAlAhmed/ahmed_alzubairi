import { describe, expect, it } from "vitest";
import { languageList } from "./language-list";

describe("languageList", () => {
  it("names the languages in English in the English UI", () => {
    expect(languageList("en", ["ar", "en"])).toBe("Arabic and English");
    expect(languageList("en", ["ar"])).toBe("Arabic");
    expect(languageList("en", ["en"])).toBe("English");
  });

  it("names the languages in Arabic in the Arabic UI, with no Latin text", () => {
    expect(languageList("ar", ["ar", "en"])).toBe("العربية والإنجليزية");
    expect(languageList("ar", ["en"])).toBe("الإنجليزية");
    expect(languageList("ar", ["ar", "en"])).not.toMatch(/[A-Za-z]/);
  });
});
