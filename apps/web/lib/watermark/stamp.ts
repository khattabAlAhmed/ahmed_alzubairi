import "server-only";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { WATERMARK_STYLE, type WatermarkTile } from "./render";

/** The types a protected document may be (§6.18), and so the types stamped. */
export type StampableMime = "application/pdf" | "image/jpeg" | "image/png";

/**
 * Every page gets the tile repeated over its whole area, in a grid offset row
 * by row, so no part of a page is left clear. The grid follows the page's
 * MediaBox, whose origin need not be 0,0. The tile is an image: pdf-lib never
 * draws the text. Pages, their order and their sizes don't change.
 */
export async function stampPdf(original: Uint8Array, tile: WatermarkTile): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original, { updateMetadata: false });
  const image = await pdf.embedPng(tile.png);
  const tileWidth = tile.width / WATERMARK_STYLE.scale;
  const tileHeight = tile.height / WATERMARK_STYLE.scale;

  for (const page of pdf.getPages()) {
    const box = page.getMediaBox();
    const top = box.y + box.height;
    const right = box.x + box.width;
    for (let row = 0, y = box.y - tileHeight / 2; y < top; row += 1, y += tileHeight) {
      const offset = row % 2 === 0 ? 0 : -tileWidth / 2;
      for (let x = box.x + offset - tileWidth / 2; x < right; x += tileWidth) {
        page.drawImage(image, { x, y, width: tileWidth, height: tileHeight });
      }
    }
  }
  return pdf.save();
}

/**
 * A JPG or PNG with the tile repeated over it, in the same format. The tile is
 * sized to the image (about a third of its width, never under the tile's own
 * size at 1x), so the mark reads at any resolution, but never larger than the
 * image in either direction: sharp rejects an overlay bigger than its base.
 */
export async function stampImage(
  original: Uint8Array,
  tile: WatermarkTile,
  mime: "image/jpeg" | "image/png",
): Promise<Uint8Array> {
  const image = sharp(original, { failOn: "error" }).rotate();
  const meta = await image.metadata();
  const imageWidth = meta.autoOrient?.width ?? meta.width ?? tile.width;
  const imageHeight = meta.autoOrient?.height ?? meta.height ?? tile.height;
  const wanted = Math.max(
    Math.round(tile.width / WATERMARK_STYLE.scale),
    Math.round(imageWidth / 3),
  );
  // The largest width whose height, at the tile's aspect, still fits.
  const fitWidth = Math.floor((imageHeight * tile.width) / tile.height);
  const tileWidth = Math.max(1, Math.min(wanted, imageWidth, fitWidth));
  const sized = await sharp(tile.png)
    .resize({ width: tileWidth, height: imageHeight, fit: "inside" })
    .png()
    .toBuffer();
  const stamped = image.composite([{ input: sized, tile: true, blend: "over" }]);
  const out = mime === "image/png" ? stamped.png() : stamped.jpeg({ quality: 90 });
  return new Uint8Array(await out.toBuffer());
}

/** Stamps a document of any protected type. */
export function stampDocument(
  original: Uint8Array,
  tile: WatermarkTile,
  mime: StampableMime,
): Promise<Uint8Array> {
  return mime === "application/pdf" ? stampPdf(original, tile) : stampImage(original, tile, mime);
}
