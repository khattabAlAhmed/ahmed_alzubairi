import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { clerkLocalization } from "./localization";

describe("clerkLocalization", () => {
  it("fills the gaps in arSA and keeps its other strings", () => {
    const result = clerkLocalization("ar", ar.Clerk);
    expect(result.formFieldInputPlaceholder__emailAddress).toBe(
      ar.Clerk.emailPlaceholder,
    );
    expect(result.signIn.start.titleCombined).toBe(ar.Clerk.titleCombined);
    expect(result.signIn.start.title).toBeTruthy();
    expect(result.signUp.start.title).toBeTruthy();
  });

  it("fills the errors arSA lacks and keeps the ones it has", () => {
    const errors = clerkLocalization("ar", ar.Clerk).unstable__errors;
    expect(errors.form_password_incorrect).toBe(
      ar.Clerk.errors.passwordIncorrect,
    );
    expect(errors.form_identifier_not_found).toBeTruthy();
  });

  it("leaves out strings for components the site doesn't use", () => {
    const result = clerkLocalization("ar", ar.Clerk);
    expect(result).not.toHaveProperty("userProfile");
    expect(result).not.toHaveProperty("organizationProfile");
  });

  it("adds no Arabic to English", () => {
    const result = clerkLocalization("en", en.Clerk);
    expect(result.signIn.start.title).toBeUndefined();
    expect(result.formFieldInputPlaceholder__password).toBe(
      en.Clerk.passwordPlaceholder,
    );
  });
});
