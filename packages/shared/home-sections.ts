import { z } from "zod";
import { longTextSchema, shortTextSchema } from "./fields";

/**
 * What one language of a home section holds (`content_ar` / `content_en`, §6.2).
 * Sections that list rows from other tables hold only their heading and intro;
 * the rows come from those tables. Button labels are UI copy in `messages/`.
 */

/** The 12 sections of §6.2, in default order. */
export const HOME_SECTION_KEYS = [
  "hero",
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
