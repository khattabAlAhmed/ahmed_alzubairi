import { z } from "zod";
import { localeSchema, newsletterSourceSchema, orgTypeSchema } from "./enums";
import {
  emailSchema,
  longTextSchema,
  shortTextSchema,
} from "./fields";

/** `POST /api/contact` */
export const contactRequestSchema = z.strictObject({
  name: shortTextSchema,
  email: emailSchema,
  orgType: orgTypeSchema,
  subject: shortTextSchema,
  message: longTextSchema,
});

export type ContactRequest = z.infer<typeof contactRequestSchema>;

/** `POST /api/newsletter/subscribe`. Same answer whether or not the email exists. */
export const newsletterSubscribeRequestSchema = z.strictObject({
  email: emailSchema,
  locale: localeSchema,
  source: newsletterSourceSchema,
});

export type NewsletterSubscribeRequest = z.infer<
  typeof newsletterSubscribeRequestSchema
>;

/** `GET /api/newsletter/confirm`. Answers with a redirect. */
export const newsletterConfirmQuerySchema = z.strictObject({
  token: z.string().min(1),
});

export type NewsletterConfirmQuery = z.infer<
  typeof newsletterConfirmQuerySchema
>;

/**
 * `POST /api/resources/:id/download`. The resource's `access` decides whether
 * the route needs the email. `consent` adds it to the newsletter (§6.9), so
 * it's refused without an email.
 */
export const resourceDownloadRequestSchema = z
  .strictObject({
    email: emailSchema.optional(),
    consent: z.boolean().optional(),
  })
  .refine((body) => !body.consent || body.email !== undefined, {
    path: ["consent"],
  });

export type ResourceDownloadRequest = z.infer<
  typeof resourceDownloadRequestSchema
>;

/** `POST /api/training/custom-requests` */
export const customTrainingRequestSchema = z.strictObject({
  orgName: shortTextSchema,
  traineeCount: z.int().positive(),
  topic: shortTextSchema,
  suggestedDate: z.iso.date(),
  place: shortTextSchema.optional(),
  contactEmail: emailSchema,
});

export type CustomTrainingRequest = z.infer<typeof customTrainingRequestSchema>;

