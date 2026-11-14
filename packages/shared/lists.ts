import { z } from "zod";
import { auditActionSchema, auditEntitySchema } from "./audit";
import {
  consultationKindSchema,
  consultationStatusSchema,
  documentRequestStatusSchema,
  profileStatusSchema,
} from "./enums";
import { clerkUserIdSchema } from "./fields";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_SHORT_TEXT_LENGTH,
} from "./limits";

/**
 * What every dashboard list takes. The values arrive as query strings, so the
 * numbers are coerced. An empty `search` counts as none.
 */
const listParamFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(
    DEFAULT_PAGE_SIZE,
  ),
  search: z
    .string()
    .trim()
    .max(MAX_SHORT_TEXT_LENGTH)
    .optional()
    .transform((value) => value || undefined),
};

export const listParamsSchema = z.strictObject(listParamFields);

export type ListParams = z.infer<typeof listParamsSchema>;

/** `GET /api/admin/team` */
export const teamListParamsSchema = z.strictObject({
  ...listParamFields,
  status: profileStatusSchema.optional(),
});

export type TeamListParams = z.infer<typeof teamListParamsSchema>;

/** `GET /api/admin/clients` */
export const clientListParamsSchema = z.strictObject({
  ...listParamFields,
  status: profileStatusSchema.optional(),
});

export type ClientListParams = z.infer<typeof clientListParamsSchema>;

export const MESSAGE_READ_FILTERS = ["read", "unread"] as const;

/** The dashboard's messages list (a server read). */
export const messageListParamsSchema = z.strictObject({
  ...listParamFields,
  read: z.enum(MESSAGE_READ_FILTERS).optional(),
});

export type MessageListParams = z.infer<typeof messageListParamsSchema>;

/** The dashboard's audit log (a server read). */
export const auditLogListParamsSchema = z.strictObject({
  ...listParamFields,
  actor: clerkUserIdSchema.optional(),
  entity: auditEntitySchema.optional(),
  action: auditActionSchema.optional(),
});

export type AuditLogListParams = z.infer<typeof auditLogListParamsSchema>;

/**
 * The dashboard's consultation list (a server read, through the member's own
 * client: RLS shows the assigned or, with `consultations.view_all`, every
 * consultation). `search` matches the title.
 */
export const consultationListParamsSchema = z.strictObject({
  ...listParamFields,
  status: consultationStatusSchema.optional(),
  kind: consultationKindSchema.optional(),
});

export type ConsultationListParams = z.infer<typeof consultationListParamsSchema>;

/**
 * The dashboard's document-request list (a server read, through the member's
 * own client: RLS lets in `document_requests.recommend` and `.decide`).
 * `search` matches the client's name or the document's title.
 */
export const documentRequestListParamsSchema = z.strictObject({
  ...listParamFields,
  status: documentRequestStatusSchema.optional(),
});

export type DocumentRequestListParams = z.infer<
  typeof documentRequestListParamsSchema
>;

/** The rows `page` and `pageSize` select: `from` and `to` are both included. */
export function pageRange(params: Pick<ListParams, "page" | "pageSize">): {
  from: number;
  to: number;
} {
  const from = (params.page - 1) * params.pageSize;
  return { from, to: from + params.pageSize - 1 };
}
