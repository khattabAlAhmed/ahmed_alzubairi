import "server-only";
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";

/**
 * The default Open Graph image (§6.24), in the record's look (DESIGN.md): a
 * plain ground, the heavy rule that opens a record, the site's name as the
 * title in ink, and its line in `ink-2`. Drawn with `@napi-rs/canvas` because
 * next/og (satori) neither shapes Arabic nor lays out right to left; Skia
 * shapes with HarfBuzz, so letters join and runs read right.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const FONT_FILE = "assets/fonts/IBMPlexSansArabic-Regular.ttf";
const FAMILY = "OG Plex Arabic";

/** DESIGN.md light tokens. A share image has no dark version: feeds show it as a picture. */
const COLORS = { bg: "#FFFFFF", ink: "#1A1C1E", ink2: "#50555A", rule: "#1A1C1E" } as const;

/**
 * The frame, in px of the 1200×630 image. Feeds show it at about half size,
 * so the 2px heavy rule is drawn 4px to read as 2px there.
 */
export const OG_LAYOUT = {
  pad: 96,
  rule: 4,
  title: { size: 72, lineHeight: 100, maxLines: 2 },
  tagline: { size: 38, lineHeight: 64, maxLines: 3 },
} as const;

let registered = false;
function ensureFont(): void {
  if (registered) return;
  if (!GlobalFonts.registerFromPath(path.join(process.cwd(), FONT_FILE), FAMILY)) {
    throw new Error("og image font not registered");
  }
  registered = true;
}

type Measure = Pick<SKRSContext2D, "measureText">;

const fits = (ctx: Measure, text: string, maxWidth: number) =>
  ctx.measureText(text).width <= maxWidth;

/**
 * Greedy word wrap to `maxWidth`, measured in the context's current font. A
 * word wider than the line on its own is broken between letters.
 */
export function wrapLines(ctx: Measure, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (fits(ctx, next, maxWidth)) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (!fits(ctx, line, maxWidth) && [...line].length > 1) {
      const letters = [...line];
      let cut = letters.length - 1;
      while (cut > 1 && !fits(ctx, letters.slice(0, cut).join(""), maxWidth)) cut--;
      lines.push(letters.slice(0, cut).join(""));
      line = letters.slice(cut).join("");
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * At most `maxLines` lines of `text`. When it runs longer, the last line ends
 * with an ellipsis and still fits `maxWidth`.
 */
export function clampLines(
  ctx: Measure,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = wrapLines(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const words = (kept[maxLines - 1] ?? "").split(" ");
  let last = `${words.join(" ")}…`;
  while (!fits(ctx, last, maxWidth) && words.length > 1) {
    words.pop();
    last = `${words.join(" ")}…`;
  }
  while (!fits(ctx, last, maxWidth) && last.length > 1) {
    last = `${[...last].slice(0, -2).join("")}…`;
  }
  kept[maxLines - 1] = last;
  return kept;
}

export function renderOgImage({
  siteName,
  tagline,
  direction,
}: {
  siteName: string;
  tagline: string;
  direction: "rtl" | "ltr";
}): Buffer {
  ensureFont();
  const { width, height } = OG_SIZE;
  const { pad, rule, title, tagline: line } = OG_LAYOUT;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const rtl = direction === "rtl";
  const maxWidth = width - pad * 2;
  // The text's start edge: right in Arabic, left in English.
  const x = rtl ? width - pad : pad;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  // The heavy rule that opens a record, across the text column.
  ctx.fillStyle = COLORS.rule;
  ctx.fillRect(pad, pad, maxWidth, rule);

  ctx.direction = direction;
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.ink;
  ctx.font = `${title.size}px "${FAMILY}"`;
  const titleLines = clampLines(ctx, siteName, maxWidth, title.maxLines);
  let y = pad + rule + 48 + title.size;
  titleLines.forEach((text, i) => ctx.fillText(text, x, y + i * title.lineHeight));
  y += (titleLines.length - 1) * title.lineHeight;

  ctx.fillStyle = COLORS.ink2;
  ctx.font = `${line.size}px "${FAMILY}"`;
  y += 32 + line.lineHeight;
  clampLines(ctx, tagline, maxWidth, line.maxLines).forEach((text, i) =>
    ctx.fillText(text, x, y + i * line.lineHeight),
  );

  return canvas.toBuffer("image/png");
}
