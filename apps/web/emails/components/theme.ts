/**
 * The §13 design tokens for email. Mail apps can't read the site's CSS
 * variables, so the values live here as constants. Keep them equal to
 * `app/globals.css`.
 */
export const COLORS = {
  light: {
    navy: "#0B1F3A",
    gold: "#C9A24D",
    background: "#F7F3EA",
    surface: "#FFFFFF",
    text: "#0B1F3A",
    textSecondary: "#4A5568",
  },
  dark: {
    navy: "#0B1F3A",
    gold: "#D4B062",
    background: "#08162A",
    surface: "#11274A",
    text: "#F7F3EA",
    textSecondary: "#A9B4C6",
  },
} as const;

/**
 * System stacks: mail apps don't load web fonts. The brand fonts come first
 * for readers who have them. Each stack holds fonts with Arabic letters
 * (Segoe UI, Tahoma, Times New Roman), so one stack serves both languages:
 * the mail app picks, letter by letter, the first font that has the glyph.
 */
export const FONTS = {
  text: '"IBM Plex Sans Arabic", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, "Noto Sans Arabic", Roboto, Arial, sans-serif',
  heading:
    'Amiri, "Playfair Display", Georgia, "Times New Roman", "Noto Naskh Arabic", serif',
} as const;

/** Widths and spacing, in px. The layout is one column, 600 px at most. */
export const SIZES = {
  width: 600,
  radius: 8,
  /** Roomy enough for Arabic letter forms and their marks. */
  lineHeight: 1.75,
  headingLineHeight: 1.5,
} as const;

/**
 * Class names the dark-mode rules hook onto. Light colors are inline on every
 * element; these classes only let a mail app that honors
 * `prefers-color-scheme` swap them.
 */
export const CLASSES = {
  body: "em-body",
  header: "em-header",
  card: "em-card",
  cardPadding: "em-card-pad",
  text: "em-text",
  muted: "em-muted",
  panel: "em-panel",
  button: "em-button",
} as const;

const { dark } = COLORS;

/**
 * The only CSS outside inline styles: dark colors, and tighter padding on a
 * phone. React Email moves the body's styles onto a cell inside it, so the
 * body rule names that cell too. The header stays navy with ivory text in both schemes, so the text
 * logo never ends up dark on dark.
 */
export const HEAD_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .${CLASSES.body}, .${CLASSES.body} > table > tbody > tr > td { background-color: ${dark.background} !important; }
  .${CLASSES.header} { border-bottom-color: ${dark.gold} !important; }
  .${CLASSES.card} { background-color: ${dark.surface} !important; }
  .${CLASSES.text} { color: ${dark.text} !important; }
  .${CLASSES.muted} { color: ${dark.textSecondary} !important; }
  .${CLASSES.panel} { background-color: ${dark.background} !important; }
  .${CLASSES.button} { background-color: ${dark.gold} !important; color: ${dark.navy} !important; }
}
@media (max-width: 480px) {
  .${CLASSES.cardPadding} { padding: 24px 20px !important; }
}
`;
