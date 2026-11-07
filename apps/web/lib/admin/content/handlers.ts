import {
  canPublish,
  contentCacheTag,
  contentCreateBodySchemas,
  contentParamsSchema,
  contentUpdateBodySchemas,
  publishProblems,
  type ContentType,
  type IdResponse,
  type Locale,
  type OkResponse,
  type PublishProblem,
} from "@repo/shared";
import { adminError, baseError, type AdminError } from "../permissions";
import {
  fromColumns,
  projectImageColumns,
  toColumns,
  type ApiRow,
  type DbRow,
} from "./columns";

/** How a row is found: `home_sections` by `key`, the others by `id`. */
export type RowRef = { column: "id" | "key"; value: string };

export type WriteOutcome =
  | { ok: true; id: string }
  | { ok: false; reason: "conflict" | "invalid_reference" | "not_found" };

export type AuditEntry = {
  actorId: string;
  action: "content.publish" | "content.unpublish" | "content.edit";
  entity: ContentType;
  entityId: string;
  metadata: { fields: string[] };
};

/**
 * The database, behind an interface so tests can replace it. Reads go through
 * the user's client (RLS); writes through the service client, which the route
 * creates only after `requirePermission` passed.
 */
export type ContentStore = {
  list: (type: ContentType) => Promise<DbRow[]>;
  get: (type: ContentType, ref: RowRef) => Promise<DbRow | null>;
  insert: (type: ContentType, columns: DbRow) => Promise<WriteOutcome>;
  update: (
    type: ContentType,
    ref: RowRef,
    columns: DbRow,
  ) => Promise<WriteOutcome>;
  replaceProjectImages: (projectId: string, rows: DbRow[]) => Promise<void>;
  replaceProjectServices: (
    projectId: string,
    serviceIds: readonly string[],
  ) => Promise<WriteOutcome>;
  audit: (entry: AuditEntry) => Promise<void>;
};

export type ContentDeps = {
  locale: Locale;
  /** The signed-in user, after `requirePermission(content.manage)` passed. */
  userId: string;
  store: ContentStore;
  /** Refreshes a cache tag, so `lib/content` serves the new data. */
  revalidate: (tag: string) => void;
};

export type ContentResult<Body> =
  | { status: number; body: Body }
  | AdminError;

const PROBLEM_MESSAGES = {
  no_language: "publishNoLanguage",
  no_value: "publishNoValue",
  no_consent: "publishNoConsent",
  not_approved: "publishNotApproved",
} as const satisfies Record<PublishProblem, string>;

function parseType(rawType: unknown, locale: Locale) {
  const params = contentParamsSchema.safeParse({ type: rawType });
  return params.success
    ? { ok: true as const, type: params.data.type }
    : { ok: false as const, ...baseError("validation_failed", 400, locale) };
}

function writeFailure(
  reason: "conflict" | "invalid_reference" | "not_found",
  locale: Locale,
): AdminError {
  if (reason === "conflict") {
    return adminError("conflict", 409, "conflict", locale);
  }
  if (reason === "not_found") {
    return adminError("not_found", 404, "notFound", locale);
  }
  return adminError("validation_failed", 400, "invalidReference", locale);
}

/** 422 with the first reason the row can't be published. */
function publishRefused(problems: PublishProblem[], locale: Locale): AdminError {
  return adminError(
    "validation_failed",
    422,
    PROBLEM_MESSAGES[problems[0]],
    locale,
  );
}

/** Writes `images` and `serviceIds` of a project body, when present. */
async function writeProjectChildren(
  deps: ContentDeps,
  projectId: string,
  body: ApiRow,
): Promise<WriteOutcome> {
  const images = body.images as
    | { key: string; altAr?: string; altEn?: string; position?: number }[]
    | undefined;
  if (images) {
    await deps.store.replaceProjectImages(
      projectId,
      projectImageColumns(projectId, images),
    );
  }
  const serviceIds = body.serviceIds as string[] | undefined;
  if (serviceIds) {
    return deps.store.replaceProjectServices(projectId, serviceIds);
  }
  return { ok: true, id: projectId };
}

/** `GET /api/admin/content/:type` */
export async function listContent(
  rawType: unknown,
  deps: ContentDeps,
): Promise<ContentResult<{ rows: ApiRow[] }>> {
  const parsed = parseType(rawType, deps.locale);
  if (!parsed.ok) return parsed;
  const rows = await deps.store.list(parsed.type);
  return {
    status: 200,
    body: { rows: rows.map((row) => fromColumns(parsed.type, row)) },
  };
}

/** `POST /api/admin/content/:type`. `home_sections` has none: the 12 are seeded. */
export async function createContent(
  rawType: unknown,
  rawBody: unknown,
  deps: ContentDeps,
): Promise<ContentResult<IdResponse>> {
  const { locale } = deps;
  const parsed = parseType(rawType, locale);
  if (!parsed.ok) return parsed;
  const { type } = parsed;
  if (type === "home_sections") {
    return adminError("validation_failed", 400, "noPostCreate", locale);
  }

  const body = contentCreateBodySchemas[type].safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);
  const fields: ApiRow = body.data;

  // A new partner or testimonial is never approved yet, so it can't start published.
  const problems =
    fields.status === "published" ? publishProblems(type, fields) : [];
  if (problems.length > 0) return publishRefused(problems, locale);

  const inserted = await deps.store.insert(type, toColumns(type, fields));
  if (!inserted.ok) return writeFailure(inserted.reason, locale);
  // The row changed, so refresh the cache even if a later step fails.
  deps.revalidate(contentCacheTag(type));

  if (type === "projects") {
    const children = await writeProjectChildren(deps, inserted.id, fields);
    if (!children.ok) return writeFailure(children.reason, locale);
  }

  if (fields.status === "published") {
    await deps.store.audit({
      actorId: deps.userId,
      action: "content.publish",
      entity: type,
      entityId: inserted.id,
      metadata: { fields: Object.keys(fields).sort() },
    });
  }
  return { status: 201, body: { id: inserted.id } };
}

function auditAction(
  wasPublished: boolean,
  isPublished: boolean,
): AuditEntry["action"] | null {
  if (!wasPublished && isPublished) return "content.publish";
  if (wasPublished && !isPublished) return "content.unpublish";
  if (wasPublished && isPublished) return "content.edit";
  return null;
}

/** `PATCH /api/admin/content/:type`. `home_sections` goes by `key`, the others by `id`. */
export async function updateContent(
  rawType: unknown,
  rawBody: unknown,
  deps: ContentDeps,
): Promise<ContentResult<OkResponse>> {
  const { locale } = deps;
  const parsed = parseType(rawType, locale);
  if (!parsed.ok) return parsed;
  const { type } = parsed;

  const body = contentUpdateBodySchemas[type].safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, locale);
  const { id, key, ...changes } = body.data as ApiRow;
  const ref: RowRef =
    type === "home_sections"
      ? { column: "key", value: String(key) }
      : { column: "id", value: String(id) };

  const existing = await deps.store.get(type, ref);
  if (!existing) return writeFailure("not_found", locale);
  const current = fromColumns(type, existing);
  const next: ApiRow = { ...current, ...changes };

  // The rule applies to the row as it will be, so an edit can't leave a
  // published row without a language, consent or approval.
  const isPublished = next.status === "published";
  if (isPublished && !canPublish(type, next)) {
    return publishRefused(publishProblems(type, next), locale);
  }

  const updated = await deps.store.update(type, ref, toColumns(type, changes));
  if (!updated.ok) return writeFailure(updated.reason, locale);
  deps.revalidate(contentCacheTag(type));

  if (type === "projects") {
    const children = await writeProjectChildren(deps, ref.value, changes);
    if (!children.ok) return writeFailure(children.reason, locale);
  }

  const action = auditAction(current.status === "published", isPublished);
  if (action) {
    await deps.store.audit({
      actorId: deps.userId,
      action,
      entity: type,
      entityId: ref.value,
      metadata: { fields: Object.keys(changes).sort() },
    });
  }
  return { status: 200, body: { ok: true } };
}
