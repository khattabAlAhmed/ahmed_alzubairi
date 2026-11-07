import { describe, expect, it } from "vitest";
import { MAX_PROFILE_TEXT_LENGTH } from "./limits";
import {
  createProfileRequestSchema,
  createProfileResponseSchema,
  isIanaTimeZone,
} from "./profile";

const validBody = {
  phone: "+966501234567",
  termsAccepted: true,
  timezone: "Asia/Riyadh",
};

const without = (key: keyof typeof validBody) =>
  Object.fromEntries(
    Object.entries(validBody).filter(([name]) => name !== key),
  );

const refuses = (body: unknown) =>
  expect(createProfileRequestSchema.safeParse(body).success).toBe(false);

describe("isIanaTimeZone", () => {
  it.each(["Asia/Riyadh", "Asia/Aden", "America/New_York", "UTC", "Etc/GMT+3"])(
    "accepts %s",
    (value) => {
      expect(isIanaTimeZone(value)).toBe(true);
    },
  );

  it.each(["", "Mars/Olympus", "+03:00", "Asia/", "Asia Riyadh"])(
    "refuses %j",
    (value) => {
      expect(isIanaTimeZone(value)).toBe(false);
    },
  );
});

describe("createProfileRequestSchema", () => {
  it("accepts the required fields alone", () => {
    expect(createProfileRequestSchema.parse(validBody)).toEqual(validBody);
  });

  it("accepts every optional field", () => {
    const body = {
      ...validBody,
      orgType: "government",
      orgName: "وزارة التخطيط",
      jobTitle: "مدير مشاريع",
      locale: "ar",
    };
    expect(createProfileRequestSchema.parse(body)).toEqual(body);
  });

  it("trims text fields", () => {
    const parsed = createProfileRequestSchema.parse({
      ...validBody,
      phone: " 0501234567 ",
      orgName: "  Acme  ",
    });
    expect(parsed.phone).toBe("0501234567");
    expect(parsed.orgName).toBe("Acme");
  });

  describe("phone", () => {
    it("is required", () => {
      refuses(without("phone"));
    });

    it.each(["1234567", "+1234567", "123456789012345", "+123456789012345"])(
      "accepts %s",
      (phone) => {
        expect(
          createProfileRequestSchema.safeParse({ ...validBody, phone }).success,
        ).toBe(true);
      },
    );

    it.each([
      ["empty", ""],
      ["6 digits", "123456"],
      ["16 digits", "1234567890123456"],
      ["letters", "05012abc67"],
      ["spaces", "050 123 4567"],
      ["dashes", "050-123-4567"],
      ["a + in the middle", "0501+234567"],
      ["two leading +", "++966501234567"],
      ["Arabic-Indic digits", "٠٥٠١٢٣٤٥٦٧"],
    ])("refuses %s", (_label, phone) => {
      refuses({ ...validBody, phone });
    });
  });

  describe("consent", () => {
    it("is required", () => {
      refuses(without("termsAccepted"));
    });

    it("must be true", () => {
      refuses({ ...validBody, termsAccepted: false });
    });

    it("must be a boolean", () => {
      refuses({ ...validBody, termsAccepted: "true" });
    });
  });

  describe("timezone", () => {
    it("is required", () => {
      refuses(without("timezone"));
    });

    it("must be an IANA name", () => {
      refuses({ ...validBody, timezone: "Mars/Olympus" });
    });
  });

  it("refuses name and email: they come from Clerk", () => {
    refuses({ ...validBody, fullName: "Someone" });
    refuses({ ...validBody, email: "someone@example.com" });
  });

  it("refuses an unknown org type or locale", () => {
    refuses({ ...validBody, orgType: "شركة" });
    refuses({ ...validBody, locale: "fr" });
  });

  it("refuses blank or over-long org name and job title", () => {
    const tooLong = "x".repeat(MAX_PROFILE_TEXT_LENGTH + 1);
    refuses({ ...validBody, orgName: "   " });
    refuses({ ...validBody, orgName: tooLong });
    refuses({ ...validBody, jobTitle: "   " });
    refuses({ ...validBody, jobTitle: tooLong });
  });
});

describe("createProfileResponseSchema", () => {
  it("accepts ok", () => {
    expect(createProfileResponseSchema.parse({ ok: true })).toEqual({
      ok: true,
    });
  });

  it("refuses anything else", () => {
    expect(createProfileResponseSchema.safeParse({ ok: false }).success).toBe(
      false,
    );
  });
});
