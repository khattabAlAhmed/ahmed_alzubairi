/*
 * The color roles, for the swatches and the contrast table only. The values
 * the site uses live in app/globals.css; a test checks the two agree.
 */
export const COLOR_ROLES = [
  { key: "bg", token: "--bg", light: "#ffffff", dark: "#101213" },
  { key: "surface", token: "--surface", light: "#f3f4f4", dark: "#181b1c" },
  { key: "surfaceHover", token: "--surface-hover", light: "#eef0f0", dark: "#1f2324" },
  { key: "accentWash", token: "--accent-wash", light: "#e6f0f0", dark: "#142a2b" },
  { key: "ink", token: "--ink", light: "#1a1c1e", dark: "#e6e8e9" },
  { key: "ink2", token: "--ink-2", light: "#50555a", dark: "#9da3a7" },
  { key: "line", token: "--line", light: "#d5d8da", dark: "#2a2e30" },
  { key: "lineStrong", token: "--line-strong", light: "#7a8086", dark: "#6b7377" },
  { key: "rule", token: "--rule", light: "#1a1c1e", dark: "#e6e8e9" },
  { key: "accent", token: "--accent", light: "#0e5c61", dark: "#74c7c7" },
  { key: "onAccent", token: "--on-accent", light: "#ffffff", dark: "#101213" },
  { key: "success", token: "--success", light: "#2f6b45", dark: "#7fc19a" },
  { key: "warning", token: "--warning", light: "#8a5a00", dark: "#e0b45c" },
  { key: "danger", token: "--danger", light: "#a3322a", dark: "#f0928a" },
  { key: "info", token: "--info", light: "#2c5a8a", dark: "#8db8e6" },
] as const;

export type ColorKey = (typeof COLOR_ROLES)[number]["key"];

/**
 * Every pair that carries text or a focus ring, with the WCAG minimum it must
 * pass: 4.5 for text, 3 for the focus ring and meaningful edges.
 */
export const CONTRAST_PAIRS: { fg: ColorKey; bg: ColorKey; min: 3 | 4.5 }[] = [
  { fg: "ink", bg: "bg", min: 4.5 },
  { fg: "ink", bg: "surface", min: 4.5 },
  { fg: "ink", bg: "accentWash", min: 4.5 },
  { fg: "ink2", bg: "bg", min: 4.5 },
  { fg: "ink2", bg: "surface", min: 4.5 },
  { fg: "ink2", bg: "surfaceHover", min: 4.5 },
  { fg: "accent", bg: "bg", min: 4.5 },
  { fg: "accent", bg: "surface", min: 4.5 },
  { fg: "accent", bg: "accentWash", min: 4.5 },
  { fg: "onAccent", bg: "accent", min: 4.5 },
  { fg: "success", bg: "bg", min: 4.5 },
  { fg: "warning", bg: "bg", min: 4.5 },
  { fg: "danger", bg: "bg", min: 4.5 },
  { fg: "danger", bg: "surface", min: 4.5 },
  { fg: "info", bg: "bg", min: 4.5 },
  { fg: "lineStrong", bg: "bg", min: 3 },
];

export function roleHex(key: ColorKey, theme: "light" | "dark"): string {
  const role = COLOR_ROLES.find((item) => item.key === key);
  if (!role) throw new Error(`Unknown color role ${key}`);
  return role[theme];
}
