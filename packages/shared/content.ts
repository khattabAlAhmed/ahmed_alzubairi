import { z } from "zod";
import { contentStatusSchema, orgTypeSchema } from "./enums";
import {
  hasAnyField,
  httpsUrlSchema,
  longTextSchema,
  shortTextSchema,
  utcDatetimeSchema,
  uuidSchema,
} from "./fields";

/**
 * The `:type` of `/api/admin/content/:type`. `site_settings` and `courses` have
 * their own routes and permissions, so they're not here. `project_images` and
 * `project_services` nest in `projects`.
 */
export const CONTENT_TYPES = [
  "home_sections",
  "home_stats",
  "pages",
  "timeline_items",
  "expertise_areas",
  "services",
  "projects",
  "faqs",
  "partners",
  "testimonials",
  "posts",
  "resources",
  "media_items",
] as const;

export const contentTypeSchema = z.enum(CONTENT_TYPES);

export type ContentType = z.infer<typeof contentTypeSchema>;

/** `pages` keeps about, privacy and terms. The 12 home sections are hidden, never deleted. */
export const UNDELETABLE_CONTENT_TYPES = ["home_sections", "pages"] as const;

/** The `:type` of `DELETE /api/admin/:type/:id`. */
export const ADMIN_DELETE_TYPES = [
  "home_stats",
  "timeline_items",
  "expertise_areas",
  "services",
  "projects",
  "faqs",
  "partners",
  "testimonials",
  "posts",
  "resources",
  "media_items",
  "documents",
  "courses",
  "consultations",
] as const;

export const adminDeleteTypeSchema = z.enum(ADMIN_DELETE_TYPES);

export type AdminDeleteType = z.infer<typeof adminDeleteTypeSchema>;

export const PAGE_KEYS = ["about", "privacy", "terms"] as const;

export const pageKeySchema = z.enum(PAGE_KEYS);

export type PageKey = z.infer<typeof pageKeySchema>;

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

export const TIMELINE_KINDS = ["career", "qualification"] as const;

export const timelineKindSchema = z.enum(TIMELINE_KINDS);

export type TimelineKind = z.infer<typeof timelineKindSchema>;

export const FAQ_CATEGORIES = [
  "consultations",
  "training",
  "documents",
  "account",
] as const;

export const faqCategorySchema = z.enum(FAQ_CATEGORIES);

export type FaqCategory = z.infer<typeof faqCategorySchema>;

export const MEDIA_CATEGORIES = ["media", "events", "conferences"] as const;

export const mediaCategorySchema = z.enum(MEDIA_CATEGORIES);

export type MediaCategory = z.infer<typeof mediaCategorySchema>;

export const RESOURCE_KINDS = ["guide", "template", "working_paper"] as const;

export const resourceKindSchema = z.enum(RESOURCE_KINDS);

export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const RESOURCE_ACCESS_MODES = ["direct", "email"] as const;

export const resourceAccessSchema = z.enum(RESOURCE_ACCESS_MODES);

export type ResourceAccess = z.infer<typeof resourceAccessSchema>;

/** A Tiptap document. It's stored as JSON and never as HTML (§9). */
export const tiptapDocSchema = z.looseObject({
  type: z.literal("doc"),
  content: z.array(z.json()).optional(),
});

export type TiptapDoc = z.infer<typeof tiptapDocSchema>;

const slugSchema = z
  .string()
  .regex(/^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u)
  .max(200);

const uploadKeySchema = z.string().min(1);
const positionSchema = z.int().nonnegative();

/**
 * Optional `<name>Ar` and `<name>En` fields. A row is available in a language
 * when that language is filled (§7), so the route checks fields at publish.
 */
function localized<Name extends string, Schema extends z.ZodType>(
  name: Name,
  schema: Schema,
) {
  return {
    [`${name}Ar`]: schema.optional(),
    [`${name}En`]: schema.optional(),
  } as Record<`${Name}Ar` | `${Name}En`, z.ZodOptional<Schema>>;
}

const shared = { status: contentStatusSchema };

const homeStatBody = z.strictObject({
  ...shared,
  ...localized("label", shortTextSchema),
  value: shortTextSchema.optional(),
  position: positionSchema.optional(),
});

const pageBody = z.strictObject({
  ...shared,
  key: pageKeySchema,
  ...localized("title", shortTextSchema),
  ...localized("body", tiptapDocSchema),
});

const timelineItemBody = z.strictObject({
  ...shared,
  kind: timelineKindSchema,
  ...localized("title", shortTextSchema),
  ...localized("description", longTextSchema),
  period: shortTextSchema.optional(),
  position: positionSchema.optional(),
});

const expertiseAreaBody = z.strictObject({
  ...shared,
  slug: slugSchema,
  ...localized("title", shortTextSchema),
  ...localized("summary", longTextSchema),
  ...localized("body", tiptapDocSchema),
  position: positionSchema.optional(),
});

const serviceBody = z.strictObject({
  ...shared,
  slug: slugSchema,
  expertiseId: uuidSchema.optional(),
  ...localized("title", shortTextSchema),
  ...localized("summary", longTextSchema),
  ...localized("audience", longTextSchema),
  ...localized("deliverables", longTextSchema),
  ...localized("stages", longTextSchema),
  isFeatured: z.boolean().optional(),
  position: positionSchema.optional(),
});

const projectImageSchema = z.strictObject({
  key: uploadKeySchema,
  ...localized("alt", shortTextSchema),
  position: positionSchema.optional(),
});

const projectBody = z.strictObject({
  ...shared,
  slug: slugSchema,
  expertiseId: uuidSchema.optional(),
  orgType: orgTypeSchema.optional(),
  ...localized("title", shortTextSchema),
  ...localized("orgName", shortTextSchema),
  ...localized("orgLabel", shortTextSchema),
  hideOrgName: z.boolean().optional(),
  ...localized("goal", longTextSchema),
  ...localized("role", longTextSchema),
  ...localized("duration", shortTextSchema),
  ...localized("activities", longTextSchema),
  ...localized("results", longTextSchema),
  ...localized("keyResult", shortTextSchema),
  isFeatured: z.boolean().optional(),
  images: z.array(projectImageSchema).optional(),
  serviceIds: z.array(uuidSchema).optional(),
});

const faqBody = z.strictObject({
  ...shared,
  category: faqCategorySchema,
  serviceId: uuidSchema.optional(),
  ...localized("question", shortTextSchema),
  ...localized("answer", longTextSchema),
  position: positionSchema.optional(),
});

/**
 * The route must refuse `status: "published"` unless `consent_confirmed` and
 * `admin_approved` are both true (§6.11). `admin_approved` and `approved_by`
 * are set only by the approve routes.
 */
const partnerBody = z.strictObject({
  ...shared,
  ...localized("name", shortTextSchema),
  logoKey: uploadKeySchema.optional(),
  consentConfirmed: z.boolean().optional(),
  position: positionSchema.optional(),
});

/**
 * The route must refuse `status: "published"` unless `consent_confirmed` and
 * `admin_approved` are both true (§6.11). `admin_approved` and `approved_by`
 * are set only by the approve routes.
 */
const testimonialBody = z.strictObject({
  ...shared,
  ...localized("quote", longTextSchema),
  ...localized("author", shortTextSchema),
  partnerId: uuidSchema.optional(),
  letterKey: uploadKeySchema.optional(),
  consentConfirmed: z.boolean().optional(),
  position: positionSchema.optional(),
});

/** A post may have one language. Publishing in a language needs that language's slug. */
const postBody = z.strictObject({
  ...shared,
  ...localized("slug", slugSchema),
  expertiseId: uuidSchema.optional(),
  ...localized("title", shortTextSchema),
  ...localized("excerpt", longTextSchema),
  ...localized("body", tiptapDocSchema),
  coverKey: uploadKeySchema.optional(),
  ...localized("readingMinutes", z.int().positive()),
  publishedAt: utcDatetimeSchema.optional(),
});

const resourceBody = z.strictObject({
  ...shared,
  expertiseId: uuidSchema.optional(),
  kind: resourceKindSchema,
  ...localized("title", shortTextSchema),
  ...localized("description", longTextSchema),
  key: uploadKeySchema,
  access: resourceAccessSchema,
});

const mediaItemBody = z.strictObject({
  ...shared,
  category: mediaCategorySchema,
  ...localized("title", shortTextSchema),
  ...localized("outlet", shortTextSchema),
  date: z.iso.date().optional(),
  imageKey: uploadKeySchema.optional(),
  url: httpsUrlSchema.optional(),
  videoUrl: httpsUrlSchema.optional(),
});

/** `POST /api/admin/content/:type`. `home_sections` has none: the 12 are seeded. */
export const contentCreateBodySchemas = {
  home_stats: homeStatBody,
  pages: pageBody,
  timeline_items: timelineItemBody,
  expertise_areas: expertiseAreaBody,
  services: serviceBody,
  projects: projectBody,
  faqs: faqBody,
  partners: partnerBody,
  testimonials: testimonialBody,
  posts: postBody,
  resources: resourceBody,
  media_items: mediaItemBody,
} as const;

export type CreatableContentType = keyof typeof contentCreateBodySchemas;

export type ContentCreateBody<Type extends CreatableContentType> = z.infer<
  (typeof contentCreateBodySchemas)[Type]
>;

const homeSectionFields = {
  ...shared,
  key: homeSectionKeySchema,
  position: positionSchema.optional(),
  isVisible: z.boolean().optional(),
  ...localized("content", z.json()),
};

/** At least one field besides the identifier. */
const updateBody = <Shape extends z.ZodRawShape>(
  body: z.ZodObject<Shape>,
) =>
  body
    .partial()
    .extend({ id: uuidSchema })
    .refine((fields) => hasAnyField(fields, ["id"]));

/** `PATCH /api/admin/content/:type`. `home_sections` goes by `key`, and a page's `key` is fixed. */
export const contentUpdateBodySchemas = {
  home_sections: z
    .strictObject(homeSectionFields)
    .partial()
    .required({ key: true })
    .refine((fields) => hasAnyField(fields, ["key"])),
  home_stats: updateBody(homeStatBody),
  pages: updateBody(pageBody.omit({ key: true })),
  timeline_items: updateBody(timelineItemBody),
  expertise_areas: updateBody(expertiseAreaBody),
  services: updateBody(serviceBody),
  projects: updateBody(projectBody),
  faqs: updateBody(faqBody),
  partners: updateBody(partnerBody),
  testimonials: updateBody(testimonialBody),
  posts: updateBody(postBody),
  resources: updateBody(resourceBody),
  media_items: updateBody(mediaItemBody),
} as const;

export type ContentUpdateBody<Type extends ContentType> = z.infer<
  (typeof contentUpdateBodySchemas)[Type]
>;

const rowFields = {
  id: uuidSchema,
  createdAt: utcDatetimeSchema,
  updatedAt: utcDatetimeSchema,
};

const approvalFields = { adminApproved: z.boolean() };

const rowOf = <Shape extends z.ZodRawShape>(body: z.ZodObject<Shape>) =>
  body.partial().extend(rowFields);

/**
 * One dashboard row of each type, for the team only. Null columns are left out.
 * `resources` has no `key`, because that's its `storage_key` and no response
 * carries one. The `*_path` columns stay as `logoKey`, `letterKey`, `coverKey`,
 * `imageKey` and `images[].key`: the dashboard needs them to show the file.
 */
export const contentRowSchemas = {
  home_sections: z
    .strictObject(homeSectionFields)
    .partial()
    .required({ key: true })
    .extend({ updatedAt: utcDatetimeSchema }),
  home_stats: rowOf(homeStatBody),
  pages: rowOf(pageBody),
  timeline_items: rowOf(timelineItemBody),
  expertise_areas: rowOf(expertiseAreaBody),
  services: rowOf(serviceBody),
  projects: rowOf(projectBody),
  faqs: rowOf(faqBody),
  partners: rowOf(partnerBody).extend(approvalFields),
  testimonials: rowOf(testimonialBody).extend(approvalFields),
  posts: rowOf(postBody),
  resources: rowOf(resourceBody.omit({ key: true })),
  media_items: rowOf(mediaItemBody),
} as const;

export type ContentRow<Type extends ContentType> = z.infer<
  (typeof contentRowSchemas)[Type]
>;

/** `/api/admin/content/:type` */
export const contentParamsSchema = z.strictObject({ type: contentTypeSchema });

export type ContentParams = z.infer<typeof contentParamsSchema>;

/** The `GET` response of `/api/admin/content/:type`. */
export const contentListResponseSchema = <Type extends ContentType>(
  type: Type,
) => z.strictObject({ rows: z.array(contentRowSchemas[type]) });

/** `DELETE /api/admin/:type/:id` */
export const adminDeleteParamsSchema = z.strictObject({
  type: adminDeleteTypeSchema,
  id: uuidSchema,
});

export type AdminDeleteParams = z.infer<typeof adminDeleteParamsSchema>;

export const adminDeleteRequestSchema = z.strictObject({ confirm: uuidSchema });

export type AdminDeleteRequest = z.infer<typeof adminDeleteRequestSchema>;

/** True when the body's `confirm` is the row in the path. */
export function isDeleteConfirmed(
  params: AdminDeleteParams,
  body: AdminDeleteRequest,
): boolean {
  return params.id === body.confirm;
}
