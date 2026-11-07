import {
  Amiri,
  IBM_Plex_Sans_Arabic,
  Inter,
  Playfair_Display,
} from "next/font/google";

// Each font only exposes a CSS variable here. globals.css picks the pair from
// the page language, so no element needs a font class.
//
// `subsets` only sets what gets preloaded. Every subset stays available through
// `unicode-range`, so digits and Latin names on Arabic pages still use the
// Arabic pair, and the browser fetches those files only when they're needed.
//
// Only the Arabic pair is preloaded: Arabic is the default language, and the
// browser fetches the English pair on its own when an English page uses it.
//
// Headings are always bold (see globals.css), so the heading fonts load 700 only.

const amiri = Amiri({
  subsets: ["arabic"],
  weight: "700",
  variable: "--font-amiri",
  display: "swap",
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-ibm-plex-sans-arabic",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-playfair-display",
  display: "swap",
  preload: false,
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  amiri.variable,
  ibmPlexSansArabic.variable,
  playfairDisplay.variable,
  inter.variable,
].join(" ");
