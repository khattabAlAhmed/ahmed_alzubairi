import { z } from "zod";
import { longTextSchema, shortTextSchema } from "./fields";

/**
 * What one language of a home section holds (`content_ar` / `content_en`, §6.2).
 * Sections that list rows from other tables hold only their heading and intro;
 * the rows come from those tables. Button labels are UI copy in `messages/`.
 */

/** The 13 sections of §6.2, in default order. */
export const HOME_SECTION_KEYS = [
  "hero",
  "letter",
  "stats",
  "expertise",
  "audiences",
  "services",
  "projects",
  "partners",
  "testimonials",
  "media",
  "latest",
  "newsletter",
  "contact",
] as const;

export const homeSectionKeySchema = z.enum(HOME_SECTION_KEYS);

export type HomeSectionKey = z.infer<typeof homeSectionKeySchema>;

/** The letter holds 1 to this many paragraphs. */
export const LETTER_MAX_PARAGRAPHS = 6;

/** A signature scan is a PNG from the `media` target: never SVG. */
const signatureKeySchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^[^/]+\.png$/i);

/** "Who I work with" has exactly these three items: government, humanitarian, private. */
export const AUDIENCE_ITEM_COUNT = 3;

const headingFields = {
  heading: shortTextSchema,
  intro: longTextSchema.optional(),
};

const headingContentSchema = z.strictObject(headingFields);

const heroContentSchema = z.strictObject({
  name: shortTextSchema,
  title: shortTextSchema,
  valueStatement: shortTextSchema,
  /** A key from the `media` upload target. */
  photoKey: z.string().trim().min(1).max(500).optional(),
});

/**
 * Ahmed's letter, signed by hand. `signatureKey` is dark ink for the light
 * theme, `signatureDarkKey` light ink for the dark theme. While
 * `isPlaceholder` is true the page tags it «نص وتوقيع مؤقتان».
 */
const letterContentSchema = z.strictObject({
  heading: shortTextSchema,
  salutation: shortTextSchema,
  paragraphs: z.array(longTextSchema).min(1).max(LETTER_MAX_PARAGRAPHS),
  signOff: shortTextSchema,
  signatureKey: signatureKeySchema.optional(),
  signatureDarkKey: signatureKeySchema.optional(),
  isPlaceholder: z.boolean(),
});

const audienceItemSchema = z.strictObject({
  title: shortTextSchema,
  description: longTextSchema.optional(),
});

const audiencesContentSchema = z.strictObject({
  ...headingFields,
  items: z.array(audienceItemSchema).length(AUDIENCE_ITEM_COUNT),
});

export const homeSectionContentSchemas = {
  hero: heroContentSchema,
  letter: letterContentSchema,
  stats: headingContentSchema,
  expertise: headingContentSchema,
  audiences: audiencesContentSchema,
  services: headingContentSchema,
  projects: headingContentSchema,
  partners: headingContentSchema,
  testimonials: headingContentSchema,
  media: headingContentSchema,
  latest: headingContentSchema,
  newsletter: headingContentSchema,
  contact: headingContentSchema,
} as const satisfies Record<HomeSectionKey, z.ZodType>;

export type HomeSectionContent<Key extends HomeSectionKey> = z.infer<
  (typeof homeSectionContentSchemas)[Key]
>;
