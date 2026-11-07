import { z } from "zod";
import {
  consultationStatusSchema,
  contentStatusSchema,
  courseTypeSchema,
  documentAccessModeSchema,
  documentCategorySchema,
  documentRecommendationSchema,
  emailEventSchema,
  orgTypeSchema,
  profileStatusSchema,
  localeSchema,
} from "./enums";
import {
  clerkUserIdSchema,
  emailSchema,
  hasAnyField,
  httpsUrlSchema,
  longTextSchema,
  shortTextSchema,
  utcDatetimeSchema,
  uuidSchema,
} from "./fields";
import { PERMISSIONS, type Permission } from "./permissions";

/**
 * `PATCH /api/admin/consultations/:id`. At least one field. `assignedTo: null`
 * unassigns. The route checks each field's permission separately (§8).
 */
export const updateConsultationRequestSchema = z
  .strictObject({
    status: consultationStatusSchema.optional(),
    assignedTo: clerkUserIdSchema.nullable().optional(),
  })
  .refine((body) => hasAnyField(body));

export type UpdateConsultationRequest = z.infer<
  typeof updateConsultationRequestSchema
>;

const meetingFields = {
  platform: shortTextSchema,
  url: httpsUrlSchema,
  startsAt: utcDatetimeSchema,
  durationMinutes: z.int().positive(),
};

/** `POST /api/admin/consultations/:id/meetings` */
export const createMeetingRequestSchema = z.strictObject(meetingFields);

export type CreateMeetingRequest = z.infer<typeof createMeetingRequestSchema>;

/** `PATCH /api/admin/consultations/:id/meetings`. At least one field besides `meetingId`. */
export const updateMeetingRequestSchema = z
  .strictObject({
    meetingId: uuidSchema,
    platform: meetingFields.platform.optional(),
    url: meetingFields.url.optional(),
    startsAt: meetingFields.startsAt.optional(),
    durationMinutes: meetingFields.durationMinutes.optional(),
  })
  .refine((body) => hasAnyField(body, ["meetingId"]));

export type UpdateMeetingRequest = z.infer<typeof updateMeetingRequestSchema>;

/**
 * `PATCH /api/admin/testimonials/:id/approve` and
 * `PATCH /api/admin/partners/:id/approve`. The server sets `approved_by`.
 */
export const approveRequestSchema = z.strictObject({ approved: z.boolean() });

export type ApproveRequest = z.infer<typeof approveRequestSchema>;

/** `POST /api/admin/document-requests/:id/recommend` */
export const recommendDocumentRequestSchema = z.strictObject({
  recommendation: documentRecommendationSchema,
  note: longTextSchema.optional(),
});

export type RecommendDocumentRequest = z.infer<
  typeof recommendDocumentRequestSchema
>;

/** There is no rejection (§6.18): these are the only decisions. */
export const DOCUMENT_DECISIONS = [
  "grant",
  "contact_first",
  "withdraw",
] as const;

export type DocumentDecision = (typeof DOCUMENT_DECISIONS)[number];

const futureDatetimeSchema = utcDatetimeSchema.refine(
  (value) => Date.parse(value) > Date.now(),
);

/** `POST /api/admin/document-requests/:id/decide` */
export const decideDocumentRequestSchema = z.discriminatedUnion("decision", [
  z.strictObject({
    decision: z.literal("grant"),
    expiresAt: futureDatetimeSchema.optional(),
  }),
  z.strictObject({ decision: z.literal("contact_first") }),
  z.strictObject({ decision: z.literal("withdraw") }),
]);

export type DecideDocumentRequest = z.infer<typeof decideDocumentRequestSchema>;

const documentFields = {
  category: documentCategorySchema,
  titleAr: shortTextSchema,
  titleEn: shortTextSchema,
  accessMode: documentAccessModeSchema,
  status: contentStatusSchema,
};

/** Never the `storage_key`. */
export const adminDocumentSchema = z.strictObject({
  id: uuidSchema,
  category: documentCategorySchema,
  titleAr: z.string(),
  titleEn: z.string(),
  mime: z.string(),
  accessMode: documentAccessModeSchema,
  status: contentStatusSchema,
});

export type AdminDocument = z.infer<typeof adminDocumentSchema>;

/** `GET /api/admin/documents` */
export const adminDocumentListResponseSchema = z.strictObject({
  documents: z.array(adminDocumentSchema),
});

export type AdminDocumentListResponse = z.infer<
  typeof adminDocumentListResponseSchema
>;

/** `POST /api/admin/documents`. `key` comes from `uploads/finalize`. */
export const createDocumentSchema = z.strictObject({
  ...documentFields,
  key: z.string().min(1),
});

export type CreateDocument = z.infer<typeof createDocumentSchema>;

/** `PATCH /api/admin/documents`. At least one field besides `id`. */
export const updateDocumentSchema = z
  .strictObject({
    id: uuidSchema,
    category: documentFields.category.optional(),
    titleAr: documentFields.titleAr.optional(),
    titleEn: documentFields.titleEn.optional(),
    accessMode: documentFields.accessMode.optional(),
    status: documentFields.status.optional(),
    key: z.string().min(1).optional(),
  })
  .refine((body) => hasAnyField(body, ["id"]));

export type UpdateDocument = z.infer<typeof updateDocumentSchema>;

const courseFields = {
  slug: shortTextSchema,
  type: courseTypeSchema,
  titleAr: shortTextSchema.optional(),
  titleEn: shortTextSchema.optional(),
  descriptionAr: longTextSchema.optional(),
  descriptionEn: longTextSchema.optional(),
  audienceAr: longTextSchema.optional(),
  audienceEn: longTextSchema.optional(),
  startsAt: utcDatetimeSchema.optional(),
  placeAr: shortTextSchema.optional(),
  placeEn: shortTextSchema.optional(),
  onlineUrl: httpsUrlSchema.optional(),
  seats: z.int().positive().optional(),
  status: contentStatusSchema,
};

export const adminCourseSchema = z.strictObject({
  id: uuidSchema,
  slug: z.string(),
  type: courseTypeSchema,
  titleAr: z.string().nullable(),
  titleEn: z.string().nullable(),
  descriptionAr: z.string().nullable(),
  descriptionEn: z.string().nullable(),
  audienceAr: z.string().nullable(),
  audienceEn: z.string().nullable(),
  startsAt: utcDatetimeSchema.nullable(),
  placeAr: z.string().nullable(),
  placeEn: z.string().nullable(),
  onlineUrl: z.string().nullable(),
  seats: z.int().nullable(),
  status: contentStatusSchema,
});

export type AdminCourse = z.infer<typeof adminCourseSchema>;

/** `GET /api/admin/courses` */
export const adminCourseListResponseSchema = z.strictObject({
  courses: z.array(adminCourseSchema),
});

export type AdminCourseListResponse = z.infer<
  typeof adminCourseListResponseSchema
>;

/** `POST /api/admin/courses` */
export const createCourseSchema = z.strictObject(courseFields);

export type CreateCourse = z.infer<typeof createCourseSchema>;

/** `PATCH /api/admin/courses`. At least one field besides `id`. */
export const updateCourseSchema = z
  .strictObject({ id: uuidSchema, ...courseFields })
  .partial()
  .required({ id: true })
  .refine((body) => hasAnyField(body, ["id"]));

export type UpdateCourse = z.infer<typeof updateCourseSchema>;

export const adminClientSchema = z.strictObject({
  id: clerkUserIdSchema,
  fullName: z.string(),
  email: emailSchema,
  phone: z.string(),
  orgType: orgTypeSchema.nullable(),
  orgName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  locale: localeSchema,
  status: profileStatusSchema,
  createdAt: utcDatetimeSchema,
});

export type AdminClient = z.infer<typeof adminClientSchema>;

/** `GET /api/admin/clients`. `clients.view_all`, or the §5 scoped rule. */
export const adminClientListResponseSchema = z.strictObject({
  clients: z.array(adminClientSchema),
});

export type AdminClientListResponse = z.infer<
  typeof adminClientListResponseSchema
>;

/** `PATCH /api/admin/clients`. `clients.view_all` only: disable or reactivate. */
export const updateClientRequestSchema = z.strictObject({
  id: clerkUserIdSchema,
  status: profileStatusSchema,
});

export type UpdateClientRequest = z.infer<typeof updateClientRequestSchema>;

export const adminTeamMemberSchema = z.strictObject({
  id: clerkUserIdSchema,
  fullName: z.string(),
  email: emailSchema,
  roleId: uuidSchema,
  status: profileStatusSchema,
  createdAt: utcDatetimeSchema,
});

export type AdminTeamMember = z.infer<typeof adminTeamMemberSchema>;

/** `GET /api/admin/team` */
export const adminTeamListResponseSchema = z.strictObject({
  members: z.array(adminTeamMemberSchema),
});

export type AdminTeamListResponse = z.infer<typeof adminTeamListResponseSchema>;

/** `POST /api/admin/team`. Sends the Clerk invitation. */
export const inviteTeamMemberRequestSchema = z.strictObject({
  email: emailSchema,
  roleId: uuidSchema,
});

export type InviteTeamMemberRequest = z.infer<
  typeof inviteTeamMemberRequestSchema
>;

/** `PATCH /api/admin/team`. At least one field besides `id`. */
export const updateTeamMemberRequestSchema = z
  .strictObject({
    id: clerkUserIdSchema,
    roleId: uuidSchema.optional(),
    status: profileStatusSchema.optional(),
  })
  .refine((body) => hasAnyField(body, ["id"]));

export type UpdateTeamMemberRequest = z.infer<
  typeof updateTeamMemberRequestSchema
>;

const ROLE_KEY_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

const permissionsSchema = z
  .array(
    z.enum(
      Object.values(PERMISSIONS) as [Permission, ...Permission[]],
    ),
  )
  .refine((list) => new Set(list).size === list.length);

export const adminRoleSchema = z.strictObject({
  id: uuidSchema,
  key: z.string(),
  nameAr: z.string(),
  nameEn: z.string(),
  isSystem: z.boolean(),
  permissions: permissionsSchema,
});

export type AdminRole = z.infer<typeof adminRoleSchema>;

/** `GET /api/admin/roles` */
export const adminRoleListResponseSchema = z.strictObject({
  roles: z.array(adminRoleSchema),
});

export type AdminRoleListResponse = z.infer<typeof adminRoleListResponseSchema>;

/** `POST /api/admin/roles` */
export const createRoleRequestSchema = z.strictObject({
  key: z.string().regex(ROLE_KEY_PATTERN).max(64),
  nameAr: shortTextSchema,
  nameEn: shortTextSchema,
  permissions: permissionsSchema,
});

export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

/** `PATCH /api/admin/roles`. At least one field besides `id`. A role's `key` never changes. */
export const updateRoleRequestSchema = z
  .strictObject({
    id: uuidSchema,
    nameAr: shortTextSchema.optional(),
    nameEn: shortTextSchema.optional(),
    permissions: permissionsSchema.optional(),
  })
  .refine((body) => hasAnyField(body, ["id"]));

export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;

/** `PATCH /api/admin/settings`. Phase 2 narrows `value` per key. */
export const updateSettingRequestSchema = z.strictObject({
  key: shortTextSchema,
  value: z.json(),
});

export type UpdateSettingRequest = z.infer<typeof updateSettingRequestSchema>;

/** `PATCH /api/admin/email-templates` */
export const updateEmailTemplateRequestSchema = z.strictObject({
  event: emailEventSchema,
  subjectAr: shortTextSchema,
  subjectEn: shortTextSchema,
  bodyAr: longTextSchema,
  bodyEn: longTextSchema,
});

export type UpdateEmailTemplateRequest = z.infer<
  typeof updateEmailTemplateRequestSchema
>;

/** `GET /api/admin/newsletter/export`. The response is CSV text. */
export const newsletterExportResponseSchema = z.string();

export type NewsletterExportResponse = z.infer<
  typeof newsletterExportResponseSchema
>;
