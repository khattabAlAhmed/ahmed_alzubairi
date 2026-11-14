import {
  adminDeleteRequestSchema,
  adminDeleteTypeSchema,
  contentCacheTag,
  DOCUMENTS_CACHE_TAG,
  isDeleteConfirmed,
  uuidSchema,
  type AdminDeleteType,
  type ContentType,
  type ErrorCode,
  type Locale,
  type OkResponse,
} from "@repo/shared";
import type { AuditEntry } from "@/lib/admin/audit";
import { baseError, type AdminError } from "@/lib/admin/permissions";
import ar from "@/messages/ar/DeleteErrors.json";
import en from "@/messages/en/DeleteErrors.json";

const MESSAGES = { ar, en };

/** A stored file: its bucket and key. */
export type StoredFile = { bucket: string; key: string };

/**
 * The database and Storage, behind an interface so tests can replace them.
 * Every method runs with the service client, created only after the route
 * checked `data.delete`.
 */
export type DeleteStore = {
  /** Whether the row exists. */
  exists: (type: AdminDeleteType, id: string) => Promise<boolean>;
  /** The files the row (and its child rows) point at, before it goes. */
  files: (type: AdminDeleteType, id: string) => Promise<StoredFile[]>;
  /** True while a client holds a live grant: `granted`, not yet expired. */
  hasLiveGrant: (documentId: string) => Promise<boolean>;
  /**
   * Deletes the row in one statement. Its child rows go with it through the
   * foreign keys: a consultation's messages, attachments and meetings
   * cascade, and its document requests are unlinked (`set null`), so nothing
   * is half-deleted if it fails. `in_use` when another row still references it.
   */
  deleteRow: (type: AdminDeleteType, id: string) => Promise<"deleted" | "not_found" | "in_use">;
  /** Removes objects. Throws when Storage refuses. */
  removeFiles: (files: StoredFile[]) => Promise<void>;
};

export type DeleteDeps = {
  locale: Locale;
  /** The signed-in user, after `requirePermission(data.delete)` passed. */
  userId: string;
  store: DeleteStore;
  audit: (entry: AuditEntry) => Promise<void>;
  /** Refreshes a cache tag, so `lib/content` stops serving the row. */
  revalidate: (tag: string) => void;
};

export type DeleteResult = { status: number; body: OkResponse } | AdminError;

type MessageKey = keyof typeof en;

function fail(code: ErrorCode, status: number, key: MessageKey, locale: Locale): AdminError {
  return { status, body: { error: { code, message: MESSAGES[locale][key] } } };
}

/** The cache tag a deleted row may sit under, when it has one. */
function cacheTagOf(type: AdminDeleteType): string | null {
  if (type === "documents") return DOCUMENTS_CACHE_TAG;
  if (type === "consultations" || type === "courses") return null;
  return contentCacheTag(type satisfies ContentType);
}

/** Logs what failed and a code only: never a key, a name or row data. */
function logFailure(what: string, error: unknown) {
  const code = (error as { code?: unknown; statusCode?: unknown } | null)?.code;
  console.error(`admin delete: ${what} failed (${typeof code === "string" ? code : "error"})`);
}

/**
 * `DELETE /api/admin/:type/:id` (§8). The dashboard asks twice; here the body
 * must name the same row (`{ confirm: id }`). Only the shared list of types
 * (never a log table, `profiles`, `email_outbox` or `roles`). The row and its
 * children go in one statement. Files go after their rows, so a file is never
 * removed while a row could still point at it; a file that can't be removed
 * is only an unreachable object, so it is logged and the delete still
 * succeeds. Writes `record.delete` to the audit log, with no content.
 */
export async function deleteRecord(
  rawType: unknown,
  rawId: unknown,
  body: unknown,
  { locale, userId, store, audit, revalidate }: DeleteDeps,
): Promise<DeleteResult> {
  const type = adminDeleteTypeSchema.safeParse(rawType);
  if (!type.success) return fail("validation_failed", 400, "typeNotAllowed", locale);
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return fail("not_found", 404, "notFound", locale);
  const parsed = adminDeleteRequestSchema.safeParse(body);
  if (!parsed.success) return baseError("validation_failed", 400, locale);
  const params = { type: type.data, id: id.data };
  if (!isDeleteConfirmed(params, parsed.data)) {
    return fail("validation_failed", 400, "confirmMismatch", locale);
  }

  if (!(await store.exists(params.type, params.id))) return fail("not_found", 404, "notFound", locale);
  if (params.type === "documents" && (await store.hasLiveGrant(params.id))) {
    return fail("conflict", 409, "documentGranted", locale);
  }

  // Read before the row goes: a failed delete changes nothing, so a retry reads them again.
  const files = await store.files(params.type, params.id);
  const outcome = await store.deleteRow(params.type, params.id);
  if (outcome === "not_found") return fail("not_found", 404, "notFound", locale);
  if (outcome === "in_use") return fail("conflict", 409, "inUse", locale);

  // The row is gone: clean up before the audit, so a failed audit write
  // (a 500) never leaves files or a stale cache behind.
  if (files.length > 0) {
    try {
      await store.removeFiles(files);
    } catch (error) {
      logFailure("file removal", error);
    }
  }
  const tag = cacheTagOf(params.type);
  if (tag) revalidate(tag);

  await audit({ actorId: userId, action: "record.delete", entity: params.type, entityId: params.id });
  return { status: 200, body: { ok: true } };
}
