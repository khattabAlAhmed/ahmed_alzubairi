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

  it("gives only the main button the accent, ink on hover and press", () => {
    const button = clerkAppearance.elements.formButtonPrimary;
    expect(button.backgroundColor).toBe("var(--accent)");
    expect(button.color).toBe("var(--on-accent)");
    for (const state of ["&:hover", "&:active"] as const) {
      expect(button[state]).toEqual({ backgroundColor: "var(--ink)", color: "var(--bg)" });
    }
  });

  it("keeps links ink, not accent, and every corner square", () => {
    expect(clerkAppearance.variables.colorPrimary).toBe("var(--ink)");
    expect(clerkAppearance.variables.borderRadius).toBe("0rem");
  });

  it("draws the one focus ring on inputs and buttons", () => {
    const ring = { outline: "2px solid var(--focus)", outlineOffset: "3px", boxShadow: "none" };
    expect(clerkAppearance.elements.formFieldInput["&:focus"]).toEqual(ring);
    expect(clerkAppearance.elements.formButtonPrimary["&:focus"]).toEqual(ring);
  });

  it("keeps the Phase 1 direction fixes", () => {
    expect(clerkAppearance.elements.formFieldInput).toMatchObject({ unicodeBidi: "plaintext", textAlign: "start" });
    expect(clerkAppearance.elements.identityPreviewText).toEqual({ unicodeBidi: "plaintext" });
    expect(clerkAppearance.elements.otpCodeFieldInputs).toEqual({ direction: "ltr" });
  });

  it("uses only the system's tokens: no raw colours", () => {
    const text = JSON.stringify(clerkAppearance);
    expect(text).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|--color-(text|background|primary)\b/i);
  });
});
