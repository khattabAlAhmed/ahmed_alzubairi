import { Alexandria, IBM_Plex_Mono } from "next/font/google";

// DESIGN.md "Type": one family for both scripts, and a mono for Latin data.
// Each font only exposes a CSS variable here; globals.css builds the stacks
// and the language picks the scale, so no element needs a font class.
//
// `subsets` only sets what gets preloaded. Every subset stays available through
// `unicode-range`, and the browser fetches a file only when the page uses a
// character from it.
//
// No font is preloaded (§13 Performance). A preload is sent on every page in
// both languages and competes with the stylesheet and the HTML on a slow
// network. With `display: swap` text paints at once in the size-adjusted
// fallback, so a preload never brings the first paint forward; the browser
// fetches each file as soon as the page's CSS uses it.
//
// Three weights only: 400 text, 500 headings, 600 h3. Plex Mono has no Arabic,
// so it loads Latin only and only where a `mono-*` style is used.

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-alexandria",
  display: "swap",
  preload: false,
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  preload: false,
});

export const fontVariables = [alexandria.variable, ibmPlexMono.variable].join(" ");
