import { z } from "zod";
import { MAX_LONG_TEXT_LENGTH, MAX_SHORT_TEXT_LENGTH } from "./limits";

/** Fields shared by the route schemas. */

export const uuidSchema = z.uuid();

/** A `profiles.clerk_user_id`. */
export const clerkUserIdSchema = z.string().min(1);

export const shortTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SHORT_TEXT_LENGTH);

export const longTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_LONG_TEXT_LENGTH);

export const emailSchema = z.email();

/** An ISO 8601 datetime in UTC. */
export const utcDatetimeSchema = z.iso.datetime();

export const httpsUrlSchema = z.url({ protocol: /^https$/ });

export const idParamsSchema = z.strictObject({ id: uuidSchema });

export type IdParams = z.infer<typeof idParamsSchema>;

export const okResponseSchema = z.strictObject({ ok: z.literal(true) });

export type OkResponse = z.infer<typeof okResponseSchema>;

export const idResponseSchema = z.strictObject({ id: uuidSchema });

export type IdResponse = z.infer<typeof idResponseSchema>;

export const signedUrlResponseSchema = z.strictObject({ url: z.url() });

export type SignedUrlResponse = z.infer<typeof signedUrlResponseSchema>;

/** True when an object has at least one field set. For PATCH bodies. */
export function hasAnyField(value: object, ignoring: string[] = []): boolean {
  return Object.entries(value).some(
    ([key, field]) => field !== undefined && !ignoring.includes(key),
  );
}
