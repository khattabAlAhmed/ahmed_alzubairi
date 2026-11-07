import { describe, expect, it } from "vitest";
import {
  decodePath,
  isApiPath,
  isPublicApiPath,
  localeFromReferer,
  protectedPageLocale,
} from "./paths";

describe("protectedPageLocale", () => {
  it.each([
    ["/ar/account", "ar"],
    ["/en/account/consultations", "en"],
    ["/ar/dashboard", "ar"],
    ["/en/dashboard/content", "en"],
    ["/ar/onboarding", "ar"],
  ])("protects %s", (path, locale) => {
    expect(protectedPageLocale(path)).toBe(locale);
  });

  it.each(["/", "/ar", "/en/about", "/ar/accounting", "/ar/sign-in", "/account"])(
    "leaves %s public",
    (path) => {
      expect(protectedPageLocale(path)).toBeNull();
    },
  );
});

describe("decodePath", () => {
  it("decodes what Next would decode", () => {
    expect(decodePath("/ar/%61ccount")).toBe("/ar/account");
  });

  it("gives null for a malformed path", () => {
    expect(decodePath("/ar/%E0%A4%A")).toBeNull();
  });
});

describe("isApiPath", () => {
  it("matches API routes only", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/api/profile")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
  });
});

describe("isPublicApiPath", () => {
  it.each([
    "/api/contact",
    "/api/newsletter/subscribe",
    "/api/newsletter/confirm",
    "/api/resources/abc/download",
    "/api/training/custom-requests",
    "/api/clerk/webhook",
    "/api/resend/webhook",
    "/api/cron/hourly",
    "/api/posthog-config",
  ])("lets %s through", (path) => {
    expect(isPublicApiPath(path)).toBe(true);
  });

  it.each([
    "/api/profile",
    "/api/consultations",
    "/api/admin/team",
    "/api/account/disable",
    "/api/contact/extra",
    "/api/a-route-added-later",
  ])("requires a session for %s", (path) => {
    expect(isPublicApiPath(path)).toBe(false);
  });
});

describe("localeFromReferer", () => {
  it("reads the language from the referring page", () => {
    expect(localeFromReferer("https://site.test/en/account")).toBe("en");
    expect(localeFromReferer("https://site.test/ar")).toBe("ar");
  });

  it("falls back to Arabic", () => {
    expect(localeFromReferer(null)).toBe("ar");
    expect(localeFromReferer("https://site.test/fr/x")).toBe("ar");
  });
});
