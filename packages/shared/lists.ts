import { z } from "zod";
import { auditActionSchema, auditEntitySchema } from "./audit";
import { profileStatusSchema } from "./enums";
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

/** The rows `page` and `pageSize` select: `from` and `to` are both included. */
export function pageRange(params: Pick<ListParams, "page" | "pageSize">): {
  from: number;
  to: number;
} {
  const from = (params.page - 1) * params.pageSize;
  return { from, to: from + params.pageSize - 1 };
}
