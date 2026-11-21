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

describe("safeReturnPath with the site's origin", () => {
  const ORIGIN = "https://ahmed.example";

  it.each([
    [`${ORIGIN}/ar/documents?request=a,b`, "/ar/documents?request=a,b"],
    [`${ORIGIN}/en/account#top`, "/en/account#top"],
    [`${ORIGIN}/ar/documents?request=a%2Cb`, "/ar/documents?request=a%2Cb"],
  ])("keeps the path and query of %s", (value, expected) => {
    expect(safeReturnPath(value, ORIGIN)).toBe(expected);
  });

  it("accepts the origin with a trailing slash or a path", () => {
    expect(safeReturnPath(`${ORIGIN}/ar/account`, `${ORIGIN}/`)).toBe("/ar/account");
    expect(safeReturnPath(`${ORIGIN}/ar/account`, `${ORIGIN}/ar/sign-in`)).toBe("/ar/account");
  });

  it("keeps relative paths as before", () => {
    expect(safeReturnPath("/ar/account?tab=open", ORIGIN)).toBe("/ar/account?tab=open");
    expect(safeReturnPath("//evil.example", ORIGIN)).toBeNull();
  });

  it.each([
    "https://evil.example/ar/account",
    "http://ahmed.example/ar/account",
    "https://ahmed.example.evil.example/ar/account",
    "https://ahmed.example:8443/ar/account",
    "https://ahmed.example@evil.example/ar/account",
    "https://user@ahmed.example/ar/account",
    "https://AHMED.example/ar/account",
    `${ORIGIN}`,
    `${ORIGIN}//evil.example`,
    `${ORIGIN}/%2Fevil.example`,
    `${ORIGIN}/\\evil.example`,
    `${ORIGIN}/%5Cevil.example`,
    `${ORIGIN}/\t/evil.example`,
    "//ahmed.example/ar/account",
    "javascript:alert(1)",
    `javascript:${ORIGIN}/ar/account`,
    ` ${ORIGIN}/ar/account`,
    `${ORIGIN}/ar/sign-in`,
    `${ORIGIN}/en/sign-up/verify-email-address`,
  ])("refuses %j", (value) => {
    expect(safeReturnPath(value, ORIGIN)).toBeNull();
  });

  it("refuses an absolute URL when no origin is given", () => {
    expect(safeReturnPath(`${ORIGIN}/ar/account`)).toBeNull();
    expect(safeReturnPath(`${ORIGIN}/ar/account`, null)).toBeNull();
    expect(safeReturnPath(`${ORIGIN}/ar/account`, "")).toBeNull();
  });

  it.each(["not a url", "null", "javascript:alert(1)", "file:///etc"])(
    "ignores the unusable origin %j",
    (origin) => {
      expect(safeReturnPath(`${ORIGIN}/ar/account`, origin)).toBeNull();
    },
  );
});

describe("auth paths", () => {
  it("encodes the return path", () => {
    expect(signInPath("ar", "/ar/account?a=1&b=2")).toBe(
      "/ar/sign-in?redirect_url=%2Far%2Faccount%3Fa%3D1%26b%3D2",
    );
  });

  it("leaves the parameter out when there's no return path", () => {
    expect(signUpPath("en")).toBe("/en/sign-up");
    expect(onboardingPath("en")).toBe("/en/onboarding");
  });

  it("carries the destination to onboarding", () => {
    expect(onboardingPath("ar", "/ar/account/consultations")).toBe(
      "/ar/onboarding?redirect_url=%2Far%2Faccount%2Fconsultations",
    );
  });
});
