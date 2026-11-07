import { z } from "zod";
import { emailSchema } from "./fields";

/**
 * `POST /api/clerk/webhook`, after the signature check. Only the fields we
 * read. The route ignores every event but `user.updated`, because no profile
 * exists at `user.created`.
 */
export const clerkUserUpdatedEventSchema = z.looseObject({
  type: z.literal("user.updated"),
  data: z.looseObject({
    id: z.string().min(1),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    primary_email_address_id: z.string().nullable(),
    email_addresses: z.array(
      z.looseObject({ id: z.string().min(1), email_address: emailSchema }),
    ),
  }),
});

export type ClerkUserUpdatedEvent = z.infer<typeof clerkUserUpdatedEventSchema>;

/**
 * `POST /api/resend/webhook`, after the signature check. Only the fields we
 * read. The route ignores every other event.
 */
export const resendContactUpdatedEventSchema = z.looseObject({
  type: z.literal("contact.updated"),
  data: z.looseObject({
    email: emailSchema,
    unsubscribed: z.boolean(),
  }),
});

export type ResendContactUpdatedEvent = z.infer<
  typeof resendContactUpdatedEventSchema
>;

/** `GET /api/posthog-config` */
export const posthogConfigResponseSchema = z.strictObject({
  key: z.string().min(1),
  host: z.url(),
});

export type PosthogConfigResponse = z.infer<typeof posthogConfigResponseSchema>;
