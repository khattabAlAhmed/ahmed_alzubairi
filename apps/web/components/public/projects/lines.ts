/*
 * The project page stores activities and results as plain text, one per line.
 * These read the lines into the ProjectPage board's rows. Pure, so they're
 * tested on their own.
 */

export type LabelledLine = { label: string | null; text: string };
export type ResultFigure = { value: string; text: string };

/** "- ", "• ", "1. ", "١. " at the start of a line. */
const BULLET = /^\s*(?:[-•*–]|[0-9٠-٩]+[.)])\s+/;

/** Non-empty lines, trimmed, without list bullets. */
export function textLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET, "").trim())
    .filter(Boolean);
}

/** A short time lead before ":" or " — " (three words at most, with a digit), as in "Month 1–2: listening sessions". */
const LEAD = /^([^:—]{1,40}?)\s*(?::|\s—\s)\s*(.+)$/;

/** Activities as rows: a short time label (it has a digit) when the line starts with one, then the text. */
export function activityRows(text: string | null): LabelledLine[] {
  return textLines(text).map((line) => {
    const match = LEAD.exec(line);
    if (match && /[0-9٠-٩]/.test(match[1]) && match[1].trim().split(/\s+/).length <= 3) return { label: match[1].trim(), text: match[2].trim() };
    return { label: null, text: line };
  });
}

/**
 * A figure at the start of a line: "70%", "٧٠٪", "1,200", "1 200" (groups
 * of three after a space), or a range kept whole, "10–15". In "9 days" the
 * word stays in the text.
 */
const NUMBER = "(?:[0-9٠-٩]{1,3}(?:[ \u00A0\u202F][0-9٠-٩]{3})+(?![0-9٠-٩])|[0-9٠-٩][0-9٠-٩.,٫٬]*)";
const FIGURE = new RegExp(`^([+~]?${NUMBER}(?:\\s?[–-]\\s?${NUMBER})?\\s?[%٪]?)\\s*(?:[:—–-]\\s*)?(.+)$`);

/**
 * Results that open with a number become "results in numbers"; the rest stay
 * as plain lines. A line is a figure only when what follows the number is
 * text, so a year or a date alone isn't taken for one.
 */
export function resultLines(text: string | null): { figures: ResultFigure[]; rest: string[] } {
  const figures: ResultFigure[] = [];
  const rest: string[] = [];
  for (const line of textLines(text)) {
    const match = FIGURE.exec(line);
    if (match && /[^\s0-9٠-٩.,٫٬%٪:—–-]/.test(match[2])) figures.push({ value: match[1].trim(), text: match[2].trim() });
    else rest.push(line);
  }
  return { figures, rest };
}
