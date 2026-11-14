import {
  createDocumentSchema,
  DOCUMENTS_CACHE_TAG,
  updateDocumentSchema,
  type AdminDocument,
  type AdminDocumentListResponse,
  type CreateDocument,
  type IdResponse,
  type Locale,
  type OkResponse,
  type UpdateDocument,
} from "@repo/shared";
import ar from "@/messages/ar/AdminDocumentErrors.json";
import en from "@/messages/en/AdminDocumentErrors.json";
import type { AuditEntry } from "../audit";
import { baseError, type AdminError } from "../permissions";
import { documentKeyMime } from "./keys";

const MESSAGES = { ar, en };

type MessageKey = keyof typeof en;

/** A document row as the server writes it: the file's key and type included. */
export type DocumentWrite = {
  category: CreateDocument["category"];
  title_ar: string;
  title_en: string;
  access_mode: CreateDocument["accessMode"];
  status: CreateDocument["status"];
  storage_key: string;
  mime: string;
};

/**
 * The database and Storage, behind an interface so tests can replace them.
 * Created only after `requirePermission(documents.manage)` passed.
 */
export type DocumentStore = {
  /** Every document, read with the member's own client. Never a storage key. */
  list: () => Promise<AdminDocument[]>;
  /** True when the `documents` bucket holds this key. */
  fileExists: (key: string) => Promise<boolean>;
  /** Inserts a row and returns its id. */
  insert: (row: DocumentWrite) => Promise<string>;
  /** The row's current storage key, or null when there is no such row. */
  currentKey: (id: string) => Promise<string | null>;
  /** Updates a row. False when the row is gone. */
  update: (id: string, changes: Partial<DocumentWrite>) => Promise<boolean>;
  /** Deletes an original from the `documents` bucket. */
  removeFile: (key: string) => Promise<void>;
};

export type DocumentDeps = {
  locale: Locale;
  userId: string;
  store: DocumentStore;
  audit: (entry: AuditEntry) => Promise<void>;
  revalidate: (tag: string) => void;
};

type Result<Body> = { status: 200; body: Body } | AdminError;

function documentError(
  code: "not_found" | "validation_failed",
  status: number,
  key: MessageKey,
  locale: Locale,
): AdminError {
  return { status, body: { error: { code, message: MESSAGES[locale][key] } } };
}

/**
 * Checks a key from `uploads/finalize`: the `document` target's shape and
 * types, and the file really in the `documents` bucket. Returns its type.
 */
async function checkKey(
  key: string,
  { locale, store }: Pick<DocumentDeps, "locale" | "store">,
): Promise<{ ok: true; mime: string } | { ok: false; error: AdminError }> {
  const mime = documentKeyMime(key);
  if (!mime) {
    return { ok: false, error: documentError("validation_failed", 400, "keyInvalid", locale) };
  }
  if (!(await store.fileExists(key))) {
    return { ok: false, error: documentError("not_found", 404, "fileNotFound", locale) };
  }
  return { ok: true, mime };
}

/** `GET /api/admin/documents`, after the permission check. */
export async function listDocuments({
  store,
}: Pick<DocumentDeps, "store">): Promise<{ status: 200; body: AdminDocumentListResponse }> {
  return { status: 200, body: { documents: await store.list() } };
}

/**
 * `POST /api/admin/documents`, after the permission check. The file must come
 * from `uploads/finalize` with the `document` target.
 */
export async function createDocument(
  rawBody: unknown,
  deps: DocumentDeps,
): Promise<Result<IdResponse>> {
  const body = createDocumentSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, deps.locale);
  const fields = body.data;

  const key = await checkKey(fields.key, deps);
  if (!key.ok) return key.error;

  const id = await deps.store.insert({
    category: fields.category,
    title_ar: fields.titleAr,
    title_en: fields.titleEn,
    access_mode: fields.accessMode,
    status: fields.status,
    storage_key: fields.key,
    mime: key.mime,
  });
  deps.revalidate(DOCUMENTS_CACHE_TAG);
  await deps.audit({
    actorId: deps.userId,
    action: "document.create",
    entity: "documents",
    entityId: id,
    metadata: {
      category: fields.category,
      accessMode: fields.accessMode,
      status: fields.status,
    },
  });
  return { status: 200, body: { id } };
}

/** The request's field names, as the audit log lists them. */
const FIELD_NAMES: Record<Exclude<keyof UpdateDocument, "id">, string> = {
  category: "category",
  titleAr: "titleAr",
  titleEn: "titleEn",
  accessMode: "accessMode",
  status: "status",
  key: "file",
};

/**
 * `PATCH /api/admin/documents`, after the permission check: titles, category,
 * access mode, status, or a new file. A replaced original is deleted from the
 * bucket once the row points at the new one.
 */
export async function updateDocument(
  rawBody: unknown,
  deps: DocumentDeps,
): Promise<Result<OkResponse>> {
  const body = updateDocumentSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, deps.locale);
  const { id, key: newKey, ...fields } = body.data;

  const oldKey = await deps.store.currentKey(id);
  if (oldKey === null) return documentError("not_found", 404, "notFound", deps.locale);

  const changes: Partial<DocumentWrite> = {};
  if (fields.category !== undefined) changes.category = fields.category;
  if (fields.titleAr !== undefined) changes.title_ar = fields.titleAr;
  if (fields.titleEn !== undefined) changes.title_en = fields.titleEn;
  if (fields.accessMode !== undefined) changes.access_mode = fields.accessMode;
  if (fields.status !== undefined) changes.status = fields.status;
  if (newKey !== undefined && newKey !== oldKey) {
    const key = await checkKey(newKey, deps);
    if (!key.ok) return key.error;
    changes.storage_key = newKey;
    changes.mime = key.mime;
  }

  if (!(await deps.store.update(id, changes))) {
    return documentError("not_found", 404, "notFound", deps.locale);
  }
  deps.revalidate(DOCUMENTS_CACHE_TAG);
  await deps.audit({
    actorId: deps.userId,
    action: "document.update",
    entity: "documents",
    entityId: id,
    metadata: {
      fields: (Object.keys(body.data) as (keyof UpdateDocument)[])
        .filter((name): name is Exclude<keyof UpdateDocument, "id"> => name !== "id")
        .map((name) => FIELD_NAMES[name]),
    },
  });

  if (changes.storage_key) {
    // The row already points at the new file; a leftover original is only
    // storage, never reachable without a row, so a failed delete isn't fatal.
    await deps.store.removeFile(oldKey).catch(() => {
      console.error("PATCH /api/admin/documents: old original not removed");
    });
  }
  return { status: 200, body: { ok: true } };
}
