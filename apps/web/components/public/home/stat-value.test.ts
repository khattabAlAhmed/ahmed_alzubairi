import { describe, expect, it } from "vitest";
import { formatStatValue, parseStatValue } from "./stat-value";

const count = (value: string, current: number) => {
  const stat = parseStatValue(value);
  if (!stat) throw new Error(`no number in ${value}`);
  return formatStatValue(stat, current);
};

describe("parseStatValue", () => {
  it("splits the number from the text around it", () => {
    expect(parseStatValue("15+")).toMatchObject({ prefix: "", target: 15, suffix: "+" });
    expect(parseStatValue("+40 مشروعًا")).toMatchObject({ prefix: "+", target: 40, suffix: " مشروعًا" });
  });

  it("reads grouped, decimal and Arabic-Indic numbers", () => {
    expect(parseStatValue("1,200")).toMatchObject({ target: 1200, grouped: true });
    expect(parseStatValue("4.5")).toMatchObject({ target: 4.5, decimals: 1 });
    expect(parseStatValue("١٬٢٠٠+")).toMatchObject({ target: 1200, grouped: true, arabicDigits: true });
  });

  it("returns null when there is no single number to count", () => {
    expect(parseStatValue("2010–2024")).toBeNull();
    expect(parseStatValue("many")).toBeNull();
    expect(parseStatValue("")).toBeNull();
  });
});

describe("formatStatValue", () => {
  it("keeps the original style while counting", () => {
    expect(count("15+", 0)).toBe("0+");
    expect(count("1,200", 1199.6)).toBe("1,200");
    expect(count("1,200", 600)).toBe("600");
    expect(count("4.5", 2.25)).toBe("2.3");
    expect(count("١٬٢٠٠+", 1200)).toBe("١٬٢٠٠+");
    expect(count("٤٠", 7)).toBe("٧");
  });

  it("never passes the final value", () => {
    expect(count("40", 41)).toBe("40");
  });
});
