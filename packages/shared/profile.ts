import { z } from "zod";
import { localeSchema, orgTypeSchema } from "./enums";
import {
  MAX_PROFILE_TEXT_LENGTH,
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
} from "./limits";

const PHONE_PATTERN = new RegExp(
  `^\\+?[0-9]{${PHONE_MIN_DIGITS},${PHONE_MAX_DIGITS}}$`,
);

const TIME_ZONE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

/** True for a time zone name such as `Asia/Riyadh`, false for an offset such as `+03:00`. */
export function isIanaTimeZone(value: string): boolean {
  if (!TIME_ZONE_NAME_PATTERN.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const optionalText = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PROFILE_TEXT_LENGTH)
  .optional();

/**
 * The body of `POST /api/profile`: what onboarding collects. It has no name or
 * email. The server reads those from Clerk, so the schema refuses unknown keys.
 */
export const createProfileRequestSchema = z.strictObject({
  phone: z.string().trim().regex(PHONE_PATTERN),
  termsAccepted: z.literal(true),
  timezone: z.string().refine(isIanaTimeZone),
  orgType: orgTypeSchema.optional(),
  orgName: optionalText,
  jobTitle: optionalText,
  locale: localeSchema.optional(),
});

export type CreateProfileRequest = z.infer<typeof createProfileRequestSchema>;

export const createProfileResponseSchema = z.strictObject({
  ok: z.literal(true),
});

export type CreateProfileResponse = z.infer<typeof createProfileResponseSchema>;
