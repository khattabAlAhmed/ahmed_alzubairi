import type { Locale } from "@repo/shared";

/**
 * The record's tokens (docs/design/DESIGN.md) for email. Mail apps can't read
 * the site's CSS variables, so this is the one place the tokens become hex.
 * Keep the values equal to DESIGN.md's front matter and `app/globals.css`.
 */
export const COLORS = {
  light: {
    bg: "#FFFFFF",
    ink: "#1A1C1E",
    ink2: "#50555A",
    line: "#D5D8DA",
    /** The 2px rule that opens the email. Equal to `ink`. */
    rule: "#1A1C1E",
    accent: "#0E5C61",
    onAccent: "#FFFFFF",
  },
  dark: {
    bg: "#101213",
    ink: "#E6E8E9",
    ink2: "#9DA3A7",
    line: "#2A2E30",
    rule: "#E6E8E9",
    accent: "#74C7C7",
    onAccent: "#101213",
  },
} as const;

/**
 * One sans stack for both scripts, as on the site. Mail apps don't load web
 * fonts: Alexandria comes first for readers who have it, then system fonts
 * that carry Arabic letters (Segoe UI, Tahoma, Geeza Pro, Noto Sans Arabic),
 * so the mail app finds a glyph for every letter in either language.
 */
export const FONTS = {
  sans: 'Alexandria, "Noto Sans Arabic", -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, "Geeza Pro", Roboto, Arial, sans-serif',
} as const;

type TypeStyle = { fontSize: number; lineHeight: number; fontWeight: number };

/**
 * DESIGN.md's type scale, per language: Arabic is set larger and looser than
 * English, never with English sizes.
 */
export const TYPE: Record<Locale, Record<"heading" | "body" | "small" | "caption", TypeStyle>> = {
  ar: {
    heading: { fontSize: 28, lineHeight: 1.55, fontWeight: 500 },
    body: { fontSize: 17, lineHeight: 1.95, fontWeight: 400 },
    small: { fontSize: 15, lineHeight: 1.85, fontWeight: 400 },
    caption: { fontSize: 13, lineHeight: 1.8, fontWeight: 400 },
  },
  en: {
    heading: { fontSize: 26, lineHeight: 1.25, fontWeight: 500 },
    body: { fontSize: 16, lineHeight: 1.6, fontWeight: 400 },
    small: { fontSize: 14, lineHeight: 1.5, fontWeight: 400 },
    caption: { fontSize: 13, lineHeight: 1.45, fontWeight: 400 },
  },
};

/** Widths and borders, in px. The layout is one column, 600 px at most. Corners are square. */
export const SIZES = {
  width: 600,
  ruleHeavy: 2,
  ruleHair: 1,
  /** DESIGN.md `label-col`: the label column of a details list. */
  labelCol: 120,
} as const;

/**
 * Class names the dark-mode rules hook onto. Light colors are inline on every
 * element; these classes only let a mail app that honors
 * `prefers-color-scheme` (or Outlook.com's dark mode) swap them.
 */
export const CLASSES = {
  body: "em-body",
  rule: "em-rule",
  line: "em-line",
  page: "em-page",
  text: "em-text",
  muted: "em-muted",
  details: "em-details",
  button: "em-button",
} as const;

const { dark } = COLORS;

/** The dark colors, for one selector prefix (`""` for the media query). */
function darkRules(prefix: string): string {
  const c = (name: string) => `${prefix}.${name}`;
  return [
    `${c(CLASSES.body)}, ${c(CLASSES.body)} > table > tbody > tr > td { background-color: ${dark.bg} !important; }`,
    `${c(CLASSES.rule)} { border-top-color: ${dark.rule} !important; }`,
    `${c(CLASSES.line)} { border-top-color: ${dark.line} !important; }`,
    `${c(CLASSES.details)} { border-bottom-color: ${dark.line} !important; }`,
    `${c(CLASSES.text)} { color: ${dark.ink} !important; }`,
    `${c(CLASSES.muted)} { color: ${dark.ink2} !important; }`,
    `${c(CLASSES.button)} { background-color: ${dark.accent} !important; color: ${dark.onAccent} !important; }`,
  ].join("\n  ");
}

/**
 * The only CSS outside inline styles: dark colors, and tighter padding on a
 * phone. React Email moves the body's styles onto a cell inside it, so the
 * body rule names that cell too. `[data-ogsc]` and `[data-ogsb]` are the
 * attributes Outlook.com sets in its dark mode: there the same dark tokens
 * replace its own guess. Mail apps that invert colors on their own (Gmail's
 * apps, Outlook for Windows) get near-neutral colors with high contrast, which
 * stay readable when flipped.
 */
export const HEAD_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  ${darkRules("")}
}
${darkRules("[data-ogsc] ")}
[data-ogsb] .${CLASSES.body} { background-color: ${dark.bg} !important; }
@media (max-width: 480px) {
  .${CLASSES.page} { padding-left: 16px !important; padding-right: 16px !important; }
}
`;
