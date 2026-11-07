import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorResponseSchema } from "./errors";

describe("errorResponseSchema", () => {
  it("accepts every error code", () => {
    for (const code of ERROR_CODES) {
      const body = { error: { code, message: "Something went wrong" } };
      expect(errorResponseSchema.parse(body)).toEqual(body);
    }
  });

  it("refuses an unknown code", () => {
    const body = { error: { code: "nope", message: "Something went wrong" } };
    expect(errorResponseSchema.safeParse(body).success).toBe(false);
  });

  it("refuses an empty message", () => {
    const body = { error: { code: "forbidden", message: "" } };
    expect(errorResponseSchema.safeParse(body).success).toBe(false);
  });

  it("refuses a body without the error wrapper", () => {
    const body = { code: "forbidden", message: "Something went wrong" };
    expect(errorResponseSchema.safeParse(body).success).toBe(false);
  });

  it("refuses extra fields", () => {
    const body = { error: { code: "forbidden", message: "No", stack: "x" } };
    expect(errorResponseSchema.safeParse(body).success).toBe(false);
  });
});
