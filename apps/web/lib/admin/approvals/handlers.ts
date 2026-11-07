import {
  approveRequestSchema,
  contentCacheTag,
  uuidSchema,
  type Locale,
  type OkResponse,
} from "@repo/shared";
import { adminError, baseError, type AdminError } from "../permissions";

/** The two content types that need the admin's approval (§6.11). */
export type ApprovalEntity = "testimonials" | "partners";

/** The columns one approve request writes, in a single update. */
export type ApprovalColumns = {
  admin_approved: boolean;
  approved_by: string | null;
  /** Set on a withdrawal only, so the row leaves the public site at once. */
  status?: "draft";
};

export type ApprovalAuditEntry = {
  actorId: string;
  action: "approval.grant" | "approval.withdraw";
  entity: ApprovalEntity;
  entityId: string;
  metadata: { unpublished: boolean };
};

/**
 * The database, behind an interface so tests can replace it. Service client,
 * created only after `requirePermission(testimonials.approve)` passed.
 */
export type ApprovalStore = {
  /** The row's current status, or null when it doesn't exist. */
  getStatus: (
    entity: ApprovalEntity,
    id: string,
  ) => Promise<{ status: string } | null>;
  /** Writes the columns; false when the row no longer exists. */
  update: (
    entity: ApprovalEntity,
    id: string,
    columns: ApprovalColumns,
  ) => Promise<boolean>;
  audit: (entry: ApprovalAuditEntry) => Promise<void>;
};

export type ApprovalDeps = {
  locale: Locale;
  /** The acting user from the session. The only source of `approved_by`. */
  userId: string;
  store: ApprovalStore;
  revalidate: (tag: string) => void;
};

type Result = { status: 200; body: OkResponse } | AdminError;

const notFound = (locale: Locale) =>
  adminError("not_found", 404, "notFound", locale);

/** The columns for a decision. Pure, so the rules are tested on their own. */
export function approvalColumns(
  approved: boolean,
  userId: string,
): ApprovalColumns {
  return approved
    ? { admin_approved: true, approved_by: userId }
    : // Withdrawing always drafts the row in the same write. A draft row
      // stays a draft, and a published one leaves the public site at once.
      { admin_approved: false, approved_by: null, status: "draft" };
}

/**
 * `PATCH /api/admin/testimonials/:id/approve` and
 * `PATCH /api/admin/partners/:id/approve`, after the permission check. The
 * body is only `{ approved }`: any other field, such as `approved_by`, is
 * refused by the strict schema.
 */
export async function setApproval(
  entity: ApprovalEntity,
  rawId: unknown,
  rawBody: unknown,
  { locale, userId, store, revalidate }: ApprovalDeps,
): Promise<Result> {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return notFound(locale);
  const body = approveRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);

  const current = await store.getStatus(entity, id.data);
  if (!current) return notFound(locale);

  const { approved } = body.data;
  const updated = await store.update(
    entity,
    id.data,
    approvalColumns(approved, userId),
  );
  if (!updated) return notFound(locale);
  revalidate(contentCacheTag(entity));

  await store.audit({
    actorId: userId,
    action: approved ? "approval.grant" : "approval.withdraw",
    entity,
    entityId: id.data,
    metadata: { unpublished: !approved && current.status === "published" },
  });
  return { status: 200, body: { ok: true } };
}
