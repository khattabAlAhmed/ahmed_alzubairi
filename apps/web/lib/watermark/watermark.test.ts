import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderWatermarkTile, WATERMARK_STYLE } from "./render";
import { stampDocument, stampImage, stampPdf } from "./stamp";
import { baseDirection, watermarkText } from "./text";

const AT = new Date("2026-11-14T10:00:00.000Z");

/** Pixels with any opacity in a PNG: the ink the mark puts down. */
async function inkPixels(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = info.channels - 1; i < data.length; i += info.channels) {
    if ((data[i] ?? 0) > 0) ink += 1;
  }
  return ink;
}

async function samplePdf(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i += 1) {
    const page = pdf.addPage(i === 1 ? [842, 595] : [595, 842]);
    page.drawText(`Sample page ${i + 1} (test document)`, { x: 50, y: 400, size: 18, font });
  }
  return pdf.save();
}

/** Where each image on the page is drawn: the x, y of its `cm` before `Do`. */
function imageOrigins(pdf: PDFDocument, pageIndex: number): Array<{ x: number; y: number }> {
  const page = pdf.getPage(pageIndex);
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  let text = "";
  for (const ref of streams) {
    const stream = pdf.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const filter = stream.dict.get(PDFName.of("Filter"));
    const bytes = filter ? inflateSync(stream.contents) : Buffer.from(stream.contents);
    text += `${Buffer.from(bytes).toString("latin1")}\n`;
  }
  const origins: Array<{ x: number; y: number }> = [];
  const draw = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm[\s\S]*?\/\S+ Do/g;
  for (const match of text.matchAll(draw)) {
    origins.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return origins;
}

describe("watermarkText", () => {
  it("joins the full name and the view date in the viewer's language and zone", () => {
    expect(watermarkText("Sara Ahmed", AT, "en", "Asia/Aden")).toBe("Sara Ahmed · November 14, 2026");
    expect(watermarkText("  سارة أحمد ", AT, "ar", "Asia/Aden")).toMatch(/^سارة أحمد · .*2026/);
  });

  it("uses the viewer's time zone for the date", () => {
    const lateUtc = new Date("2026-11-14T22:30:00.000Z");
    expect(watermarkText("A", lateUtc, "en", "Asia/Aden")).toBe("A · November 15, 2026");
    expect(watermarkText("A", lateUtc, "en", "America/New_York")).toBe("A · November 14, 2026");
  });

  it("falls back to UTC for a zone the runtime doesn't know", () => {
    expect(watermarkText("A", AT, "en", "Mars/Olympus")).toBe("A · November 14, 2026");
  });
});

describe("baseDirection", () => {
  it.each([
    ["سارة أحمد", "rtl"],
    ["سارة Sara", "rtl"],
    ["Sara سارة", "ltr"],
    ["Sara Ahmed", "ltr"],
    ["12 · 2026", "ltr"],
  ] as const)("reads %s as %s", (text, dir) => {
    expect(baseDirection(text)).toBe(dir);
  });
});

describe("renderWatermarkTile", () => {
  it("renders an Arabic name to a non-empty transparent PNG", async () => {
    const tile = renderWatermarkTile(watermarkText("سارة أحمد الزبيري", AT, "ar", "Asia/Aden"));
    const meta = await sharp(tile.png).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
    expect([meta.width, meta.height]).toEqual([tile.width, tile.height]);
    // A diagonal line of text: wider than tall, and well over the margin alone.
    expect(tile.width).toBeGreaterThan(tile.height);
    expect(tile.width).toBeGreaterThan(400);
    const ink = await inkPixels(tile.png);
    expect(ink).toBeGreaterThan(2000);
    // Mostly transparent: it marks the page without covering it.
    expect(ink / (tile.width * tile.height)).toBeLessThan(0.25);
  });

  it("puts down ink for the Arabic letters themselves, not just the date", async () => {
    const dateOnly = renderWatermarkTile(" · 14 نوفمبر 2026");
    const withName = renderWatermarkTile("سارة أحمد الزبيري · 14 نوفمبر 2026");
    expect(withName.width).toBeGreaterThan(dateOnly.width);
    expect(await inkPixels(withName.png)).toBeGreaterThan((await inkPixels(dateOnly.png)) * 1.3);
  });

  it("renders a mixed Arabic and Latin name", async () => {
    const tile = renderWatermarkTile("Sara سارة Ahmed · November 14, 2026");
    expect(await inkPixels(tile.png)).toBeGreaterThan(2000);
  });

  it("draws at the style's scale", () => {
    const tile = renderWatermarkTile("A");
    expect(tile.height).toBeGreaterThan(WATERMARK_STYLE.fontPx * WATERMARK_STYLE.scale);
  });
});

describe("stampPdf", () => {
  const tile = renderWatermarkTile("سارة أحمد · 14 نوفمبر 2026");

  it("keeps the page count, order and sizes, and adds the tile as an image", async () => {
    const original = await samplePdf(3);
    const stamped = await stampPdf(original, tile);
    const before = await PDFDocument.load(original);
    const after = await PDFDocument.load(stamped);
    expect(after.getPageCount()).toBe(3);
    expect(after.getPages().map((page) => page.getSize())).toEqual(
      before.getPages().map((page) => page.getSize()),
    );
    expect(stamped.length).toBeGreaterThan(original.length);
    // The mark is an embedded PNG image, drawn on every page.
    const text = Buffer.from(stamped).toString("latin1");
    expect(text).toMatch(/\/Subtype\s*\/Image/);
    for (const page of after.getPages()) {
      const xObjects = page.node.Resources()?.lookup(
        (await import("pdf-lib")).PDFName.of("XObject"),
      );
      expect(xObjects, "every page carries the image").toBeTruthy();
    }
  });

  it("tiles a page whose MediaBox doesn't start at 0,0 inside that box", async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]).setMediaBox(2000, 2000, 595, 842);
    const stamped = await PDFDocument.load(await stampPdf(await source.save(), tile));
    const box = stamped.getPage(0).getMediaBox();
    expect(box).toEqual({ x: 2000, y: 2000, width: 595, height: 842 });
    const origins = imageOrigins(stamped, 0);
    expect(origins.length).toBeGreaterThan(0);
    const tileWidth = tile.width / WATERMARK_STYLE.scale;
    const tileHeight = tile.height / WATERMARK_STYLE.scale;
    // Every tile touches the box, and tiles cover its corners and centre.
    for (const { x, y } of origins) {
      expect(x + tileWidth).toBeGreaterThanOrEqual(2000);
      expect(x).toBeLessThan(2595);
      expect(y + tileHeight).toBeGreaterThanOrEqual(2000);
      expect(y).toBeLessThan(2842);
    }
    const covered = (px: number, py: number) =>
      origins.some(({ x, y }) => px >= x && px <= x + tileWidth && py >= y && py <= y + tileHeight);
    for (const [px, py] of [[2000, 2000], [2595, 2000], [2000, 2842], [2595, 2842], [2297, 2421]]) {
      expect(covered(px ?? 0, py ?? 0), `${px},${py} is under the mark`).toBe(true);
    }
  });

  it("keeps a 30-page PDF at 30 pages", async () => {
    const stamped = await stampPdf(await samplePdf(30), tile);
    expect((await PDFDocument.load(stamped)).getPageCount()).toBe(30);
  });
});

describe("stampImage", () => {
  const tile = renderWatermarkTile("Sara Ahmed · November 14, 2026");
  const plain = (format: "png" | "jpeg") =>
    sharp({ create: { width: 1200, height: 800, channels: 3, background: "#ffffff" } })
      [format]()
      .toBuffer();

  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpeg"],
  ] as const)("stamps a %s and keeps its format and size", async (mime, format) => {
    const original = await plain(format);
    const stamped = await stampImage(original, tile, mime);
    const meta = await sharp(stamped).metadata();
    expect(meta.format).toBe(format);
    expect([meta.width, meta.height]).toEqual([1200, 800]);
    const { data } = await sharp(stamped).raw().toBuffer({ resolveWithObject: true });
    // A white page is no longer all white: the mark is on it.
    expect(data.some((value) => value < 240)).toBe(true);
  });

  it.each([
    [50, 50],
    [800, 60],
    [60, 800],
  ])("stamps a small %ix%i image without sharp rejecting the overlay", async (width, height) => {
    const original = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
      .png()
      .toBuffer();
    const stamped = await stampImage(original, tile, "image/png");
    const meta = await sharp(stamped).metadata();
    expect([meta.width, meta.height]).toEqual([width, height]);
    const { data } = await sharp(stamped).raw().toBuffer({ resolveWithObject: true });
    expect(data.some((value) => value < 255)).toBe(true);
  });

  it("stampDocument picks the stamper by type", async () => {
    const stamped = await stampDocument(await plain("png"), tile, "image/png");
    expect((await sharp(stamped).metadata()).format).toBe("png");
    const pdf = await stampDocument(await samplePdf(1), tile, "application/pdf");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});
