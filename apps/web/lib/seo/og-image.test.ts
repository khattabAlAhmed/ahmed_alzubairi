import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { clampLines, OG_LAYOUT, OG_SIZE, renderOgImage, wrapLines } from "./og-image";

const FAMILY = "OG Test Plex Arabic";
const MAX_WIDTH = OG_SIZE.width - OG_LAYOUT.pad * 2;

beforeAll(() => {
  GlobalFonts.registerFromPath(
    path.join(process.cwd(), "assets/fonts/IBMPlexSansArabic-Regular.ttf"),
    FAMILY,
  );
});

function context(size: number) {
  const ctx = createCanvas(1, 1).getContext("2d");
  ctx.font = `${size}px "${FAMILY}"`;
  return ctx;
}

/** 120 characters of Arabic, in words. */
const LONG_AR =
  "مراجعة لائحة الحوكمة وتوزيع الصلاحيات بين مجلس الإدارة والإدارة التنفيذية في مؤسسة تنموية غير ربحية خلال الأشهر القادمة.";
/** 120 characters of English, in words. */
const LONG_EN =
  "Reviewing the governance charter and the delegation of authority between the board and management of a nonprofit bodies.";

describe("wrapLines", () => {
  it("breaks text to fit the width", () => {
    const ctx = context(40);
    const lines = wrapLines(ctx, "one two three four five six seven eight", 200);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("one two three four five six seven eight");
  });

  it("breaks a word wider than the line between letters", () => {
    const ctx = context(40);
    const lines = wrapLines(ctx, "a".repeat(80), 300);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("a".repeat(80));
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(300);
  });
});

describe("clampLines", () => {
  it("keeps a short text whole", () => {
    expect(clampLines(context(72), "أحمد الزبيري", MAX_WIDTH, 2)).toEqual(["أحمد الزبيري"]);
  });

  it.each([
    ["Arabic", LONG_AR],
    ["English", LONG_EN],
  ])("clamps a 120-character %s title to two lines that fit, ending in an ellipsis", (_, text) => {
    expect(text).toHaveLength(120);
    const ctx = context(OG_LAYOUT.title.size);
    const lines = clampLines(ctx, text, MAX_WIDTH, OG_LAYOUT.title.maxLines);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(MAX_WIDTH);
  });
});

describe("renderOgImage", () => {
  it("draws a 1200×630 PNG in both directions", () => {
    for (const direction of ["rtl", "ltr"] as const) {
      const png = renderOgImage({ siteName: "Site", tagline: "استشارات في الإدارة", direction });
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(OG_SIZE.width);
      expect(png.readUInt32BE(20)).toBe(OG_SIZE.height);
    }
  });

  it("shapes Arabic: joined letters are narrower than the same letters set apart", () => {
    const ctx = context(72);
    const word = "استشارات";
    const apart = [...word].reduce((sum, letter) => sum + ctx.measureText(letter).width, 0);
    expect(ctx.measureText(word).width).toBeLessThan(apart * 0.95);
  });

  /** The horizontal extent of dark pixels in the title band. */
  async function titleInk(direction: "rtl" | "ltr", siteName: string) {
    const png = renderOgImage({ siteName, tagline: "", direction });
    const image = await loadImage(png);
    const canvas = createCanvas(OG_SIZE.width, OG_SIZE.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    // Below the rule, through the first title line.
    const top = OG_LAYOUT.pad + OG_LAYOUT.rule + 8;
    const { data } = ctx.getImageData(0, top, OG_SIZE.width, 160);
    let min: number = OG_SIZE.width;
    let max = -1;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 255) < 128) {
        const x = (i / 4) % OG_SIZE.width;
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
    }
    return { min, max };
  }

  it("sets an Arabic title from the right edge, and an English one from the left", async () => {
    const { pad } = OG_LAYOUT;
    const ar = await titleInk("rtl", "أحمد");
    expect(ar.max).toBeGreaterThan(OG_SIZE.width - pad - 12);
    expect(ar.min).toBeGreaterThan(OG_SIZE.width / 2);

    const en = await titleInk("ltr", "Ahmed");
    expect(en.min).toBeLessThan(pad + 12);
    expect(en.max).toBeLessThan(OG_SIZE.width / 2);
  });

  it("keeps a 120-character title and line inside the frame", async () => {
    for (const [direction, text] of [["rtl", LONG_AR], ["ltr", LONG_EN]] as const) {
      const png = renderOgImage({ siteName: text, tagline: `${text} ${text}`, direction });
      const image = await loadImage(png);
      const canvas = createCanvas(OG_SIZE.width, OG_SIZE.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      // Nothing dark in the side margins or the bottom 40px.
      const margins = [
        ctx.getImageData(0, 0, OG_LAYOUT.pad - 8, OG_SIZE.height),
        ctx.getImageData(OG_SIZE.width - OG_LAYOUT.pad + 8, 0, OG_LAYOUT.pad - 8, OG_SIZE.height),
        ctx.getImageData(0, OG_SIZE.height - 40, OG_SIZE.width, 40),
      ];
      for (const { data } of margins) {
        const dark = data.some((value, i) => i % 4 === 0 && value < 200);
        expect(dark).toBe(false);
      }
    }
  });
});
