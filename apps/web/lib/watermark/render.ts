import "server-only";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "node:path";
import { baseDirection } from "./text";

/** The bundled font (T01), shipped with the open route by `outputFileTracingIncludes`. */
export const WATERMARK_FONT_FILE = "assets/fonts/IBMPlexSansArabic-Regular.ttf";
const FAMILY = "Watermark Plex Arabic";

let registered = false;

function ensureFont(): void {
  if (registered) return;
  const file = path.join(process.cwd(), WATERMARK_FONT_FILE);
  if (!GlobalFonts.registerFromPath(file, FAMILY)) {
    throw new Error("watermark font not registered");
  }
  registered = true;
}

/** How the mark looks. Grey at low opacity: it marks the copy without hiding it. */
export const WATERMARK_STYLE = {
  fontPx: 30,
  angleDegrees: -30,
  color: "rgba(80, 80, 80, 0.32)",
  /** Pixels rendered per point, so the mark stays sharp when printed. */
  scale: 2,
} as const;

export type WatermarkTile = {
  png: Buffer;
  /** In pixels. Divide by `WATERMARK_STYLE.scale` for points. */
  width: number;
  height: number;
};

/**
 * One tile of the mark: the text, shaped by the canvas (HarfBuzz, so Arabic
 * letters join and right-to-left runs read right), rotated diagonally on a
 * transparent background. The PDF and image stampers repeat this tile; they
 * never draw text themselves (pdf-lib can't shape Arabic).
 */
export function renderWatermarkTile(text: string): WatermarkTile {
  ensureFont();
  const { fontPx, angleDegrees, color, scale } = WATERMARK_STYLE;
  const font = `${fontPx * scale}px "${FAMILY}"`;

  const measure = createCanvas(1, 1).getContext("2d");
  measure.font = font;
  const metrics = measure.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = Math.ceil(fontPx * scale * 1.4);

  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  // The rotated text's box, plus a margin so neighbouring tiles don't touch.
  const margin = fontPx * scale * 2;
  const width = Math.ceil(textWidth * cos + textHeight * sin + margin);
  const height = Math.ceil(textWidth * sin + textHeight * cos + margin);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = baseDirection(text);
  ctx.fillText(text, 0, 0);

  return { png: canvas.toBuffer("image/png"), width, height };
}
