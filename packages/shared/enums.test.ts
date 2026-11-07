import { describe, expect, it } from "vitest";
import {
  LOCALES,
  ORG_TYPES,
  PROFILE_STATUSES,
  localeSchema,
  orgTypeSchema,
  profileStatusSchema,
} from "./enums";

describe.each([
  { name: "orgTypeSchema", schema: orgTypeSchema, values: ORG_TYPES, bad: "حكومية" },
  { name: "localeSchema", schema: localeSchema, values: LOCALES, bad: "fr" },
  {
    name: "profileStatusSchema",
    schema: profileStatusSchema,
    values: PROFILE_STATUSES,
    bad: "banned",
  },
])("$name", ({ schema, values, bad }) => {
  it("accepts every value", () => {
    for (const value of values) expect(schema.parse(value)).toBe(value);
  });

  it("refuses anything else", () => {
    expect(schema.safeParse(bad).success).toBe(false);
  });
});
