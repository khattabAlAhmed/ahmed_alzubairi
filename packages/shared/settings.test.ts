import { describe, expect, it } from "vitest";
import {
  MAX_SOCIAL_LINKS,
  parseSiteSettings,
  SETTING_KEYS,
  settingValueSchemas,
  siteSettingsSchema,
  updateSettingRequestSchema,
} from "./settings";

const accepts = (key: string, value: unknown) =>
  updateSettingRequestSchema.safeParse({ key, value }).success;

const BAD_URLS = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "http://example.com",
  "ftp://example.com",
  "//example.com",
  "example.com",
  "",
];

describe("site settings", () => {
  it("has one value schema per key", () => {
    expect(Object.keys(settingValueSchemas).sort()).toEqual(
      [...SETTING_KEYS].sort(),
    );
  });

  it("accepts a valid value for each key", () => {
    expect(accepts("contact_email", "ahmed@example.com")).toBe(true);
    expect(accepts("whatsapp_number", "+967712345678")).toBe(true);
    expect(accepts("linkedin_url", "https://www.linkedin.com/in/ahmed")).toBe(
      true,
    );
    expect(accepts("linkedin_url", "https://linkedin.com/in/ahmed")).toBe(true);
    expect(
      accepts("social_links", [
        { platform: "X", url: "https://x.com/ahmed" },
        { platform: "YouTube", url: "https://youtube.com/@ahmed" },
      ]),
    ).toBe(true);
    expect(accepts("social_links", [])).toBe(true);
    expect(accepts("cv_visible", false)).toBe(true);
    expect(accepts("cv_file_key", "media/cv.pdf")).toBe(true);
  });

  it("refuses an unknown key", () => {
    expect(accepts("site_name", "x")).toBe(false);
  });

  it("refuses a value of the wrong key's type", () => {
    expect(accepts("cv_visible", "true")).toBe(false);
    expect(accepts("contact_email", true)).toBe(false);
    expect(accepts("cv_file_key", "")).toBe(false);
  });

  it.each(BAD_URLS)("refuses %j as the LinkedIn URL", (url) => {
    expect(accepts("linkedin_url", url)).toBe(false);
  });

  it.each(BAD_URLS)("refuses %j as a social link URL", (url) => {
    expect(accepts("social_links", [{ platform: "X", url }])).toBe(false);
  });

  it("refuses a LinkedIn URL on another host", () => {
    expect(accepts("linkedin_url", "https://linkedin.com.evil.example")).toBe(
      false,
    );
    expect(accepts("linkedin_url", "https://evil-linkedin.com/in/x")).toBe(
      false,
    );
  });

  it("refuses a social link without a platform, or with extra fields", () => {
    expect(
      accepts("social_links", [{ platform: " ", url: "https://x.com" }]),
    ).toBe(false);
    expect(
      accepts("social_links", [
        { platform: "X", url: "https://x.com", html: "<b>" },
      ]),
    ).toBe(false);
  });

  it(`refuses more than ${MAX_SOCIAL_LINKS} social links`, () => {
    const links = Array.from({ length: MAX_SOCIAL_LINKS + 1 }, () => ({
      platform: "X",
      url: "https://x.com",
    }));
    expect(accepts("social_links", links)).toBe(false);
  });

  it.each(["967712345678", "+0712345678", "+96 77 123", "+12345", "+abc"])(
    "refuses %j as the WhatsApp number",
    (number) => {
      expect(accepts("whatsapp_number", number)).toBe(false);
    },
  );

  it("refuses an invalid email", () => {
    expect(accepts("contact_email", "not-an-email")).toBe(false);
  });

  it("refuses extra fields on the request", () => {
    expect(
      updateSettingRequestSchema.safeParse({
        key: "cv_visible",
        value: true,
        extra: 1,
      }).success,
    ).toBe(false);
  });
});

describe("parseSiteSettings", () => {
  it("keeps valid rows and drops unknown keys and invalid values", () => {
    const settings = parseSiteSettings([
      { key: "contact_email", value: "ahmed@example.com" },
      { key: "cv_visible", value: true },
      { key: "linkedin_url", value: "javascript:alert(1)" },
      { key: "social_links", value: [{ platform: "X", url: "http://x.com" }] },
      { key: "unknown", value: "x" },
    ]);
    expect(settings).toEqual({
      contact_email: "ahmed@example.com",
      cv_visible: true,
    });
  });

  it("returns an empty object with no rows", () => {
    expect(parseSiteSettings([])).toEqual({});
  });

  it("matches siteSettingsSchema", () => {
    const settings = parseSiteSettings([{ key: "cv_visible", value: false }]);
    expect(siteSettingsSchema.safeParse(settings).success).toBe(true);
  });
});
