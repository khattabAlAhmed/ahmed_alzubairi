/** Joins class names, skipping empty ones. */
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * One focus ring for every interactive component: the `focus-ring` utility in
 * globals.css (2px `focus`, 3px offset, solid; DESIGN.md "States").
 */
export const FOCUS_RING = "focus-ring";
