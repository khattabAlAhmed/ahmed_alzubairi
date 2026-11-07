import { createProfileRequestSchema } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

const phoneSchema = createProfileRequestSchema.shape.phone;

describe("normalizePhone", () => {
  it.each([
    ["٠٥٠١٢٣٤٥٦٧", "0501234567"],
    ["۰۵۰۱۲۳۴۵۶۷", "0501234567"],
    ["050 123 4567", "0501234567"],
    ["+966 50 123 4567", "+966501234567"],
    ["(050) 123-4567", "0501234567"],
    ["+٩٦٦ ٥٠ ١٢٣ ٤٥٦٧", "+966501234567"],
    ["050 123–4567", "0501234567"],
    ["0501234567", "0501234567"],
  ])("%s becomes %s, which the schema accepts", (input, expected) => {
    const result = normalizePhone(input);
    expect(result).toBe(expected);
    expect(phoneSchema.safeParse(result).success).toBe(true);
  });

  it.each(["050.123.4567", "phone 0501234567", "05+01234567", "123"])(
    "leaves %s for the schema to refuse",
    (input) => {
      expect(phoneSchema.safeParse(normalizePhone(input)).success).toBe(false);
    },
  );

  it("doesn't loosen the schema itself", () => {
    expect(phoneSchema.safeParse("050 123 4567").success).toBe(false);
    expect(phoneSchema.safeParse("٠٥٠١٢٣٤٥٦٧").success).toBe(false);
  });
});
