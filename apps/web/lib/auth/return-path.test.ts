import { describe, expect, it } from "vitest";
import {
  onboardingPath,
  safeReturnPath,
  signInPath,
  signUpPath,
} from "./return-path";

describe("safeReturnPath", () => {
  it.each([
    ["/ar/account", "/ar/account"],
    ["/en/account/consultations?tab=open", "/en/account/consultations?tab=open"],
    ["/ar/account#top", "/ar/account#top"],
  ])("keeps the same-site path %s", (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "http://evil.example/ar/account",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/%2Fevil.example",
    "/%5Cevil.example",
    "/\t/evil.example",
    "\t//evil.example",
    "javascript:alert(1)",
    "data:text/html,x",
    "evil.example",
    "ar/account",
    "/%E0%A4%A",
    "",
  ])("refuses %j", (value) => {
    expect(safeReturnPath(value)).toBeNull();
  });

  it("refuses a missing value", () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
  });

  it.each(["/ar/sign-in", "/en/sign-up/verify-email-address"])(
    "refuses %s, which would loop",
    (value) => {
      expect(safeReturnPath(value)).toBeNull();
    },
  );
});

describe("auth paths", () => {
  it("encodes the return path", () => {
    expect(signInPath("ar", "/ar/account?a=1&b=2")).toBe(
      "/ar/sign-in?return_to=%2Far%2Faccount%3Fa%3D1%26b%3D2",
    );
  });

  it("leaves the parameter out when there's no return path", () => {
    expect(signUpPath("en")).toBe("/en/sign-up");
    expect(onboardingPath("en")).toBe("/en/onboarding");
  });

  it("carries the destination to onboarding", () => {
    expect(onboardingPath("ar", "/ar/account/consultations")).toBe(
      "/ar/onboarding?return_to=%2Far%2Faccount%2Fconsultations",
    );
  });
});
