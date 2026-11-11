import { describe, expect, it } from "vitest";
import { clerkAppearance } from "./appearance";

// Clerk's own check, from `warnAboutCustomizationWithoutPinning` in @clerk/ui.
// It runs on every nested selector (a key that starts with "&") and logs the
// "Structural CSS" warning when one of these matches.
const CLERK_CLASS = /\.cl-[A-Za-z0-9_-]+/;
const POSITIONAL_PSEUDO =
  /:(nth-child|nth-of-type|first-child|last-child|only-child|empty)\b/i;
const HAS = /:has\(/i;
const OTHER_SELECTOR = /[.#\w[:]/;
const COMBINATOR = /[>+~\s]/;

function isStructural(selector: string): boolean {
  if (!selector.startsWith("&")) return false;
  if (CLERK_CLASS.test(selector)) return true;
  if (POSITIONAL_PSEUDO.test(selector)) return true;
  if (HAS.test(selector)) return true;
  const rest = selector.replace(/^&\s*/, "");
  return OTHER_SELECTOR.test(rest) && COMBINATOR.test(selector);
}

function structuralSelectors(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => [
    ...(isStructural(key) ? [key] : []),
    ...structuralSelectors(nested),
  ]);
}

describe("clerkAppearance", () => {
  it("has no selector that Clerk reports as structural CSS", () => {
    expect(structuralSelectors(clerkAppearance.elements)).toEqual([]);
  });

  it("the check catches the comma list it replaced", () => {
    expect(isStructural("&:hover, &:focus, &:active")).toBe(true);
    expect(isStructural("&:hover")).toBe(false);
  });

  it("keeps the main button gold with navy text", () => {
    const button = clerkAppearance.elements.formButtonPrimary;
    expect(button.backgroundColor).toBe("var(--color-accent)");
    expect(button.color).toBe("var(--color-on-accent)");
  });

  it.each(["&:hover", "&:focus", "&:active"] as const)(
    "keeps the main button gold and dimmed on %s",
    (state) => {
      expect(clerkAppearance.elements.formButtonPrimary[state]).toEqual({
        backgroundColor: "var(--color-accent)",
        opacity: 0.9,
      });
    },
  );
});
