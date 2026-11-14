import {
  createDocumentRequestSchema,
  decideDocumentRequestSchema,
  EMAIL_ADMIN_PERMISSION,
  PERMISSIONS,
  recommendDocumentRequestSchema,
  uuidSchema,
  type CreateDocumentRequestResponse,
  type DecideDocumentRequestDecision,
  type DocumentRecommendation,
  type DocumentRequestStatus,
  type EmailEvent,
  type EmailPayload,
  type Locale,
  type LocalizedText,
  type OkResponse,
  type Permission,
} from "@repo/shared";
import type { AuditEntry } from "@/lib/admin/audit";
import { baseError } from "@/lib/admin/permissions";
import { DocumentRequestError, requestError, type RouteError } from "./errors";

/** Someone an email goes to, in their own language. */
export type Recipient = { userId: string; email: string; locale: Locale };

/** A request as the admin routes need it. Read after the permission check. */
export type RequestInfo = {
  id: string;
  status: DocumentRequestStatus;
  documentTitle: LocalizedText;
  client: Recipient & { fullName: string };
};

/** One row `request_document` answers with. */
export type RequestedRow = {
  requestId: string;
  documentId: string;
  status: DocumentRequestStatus;
  merged: boolean;
};

/**
 * The database, behind an interface so tests can replace it. The functions
 * throw `DocumentRequestError` for a refusal the user should see.
 */
export type DocumentRequestStore = {
  /** The caller's own profile, read through their own client (RLS), or null. */
  ownProfile: () => Promise<{ fullName: string } | null>;
  /** `request_document`. */
  request: (clientId: string, documentIds: string[], purpose: string) => Promise<RequestedRow[]>;
  /** Titles of these documents, by id. */
  documentTitles: (ids: string[]) => Promise<Map<string, LocalizedText>>;
  /** Every active member whose role holds any of these permissions, each once. */
  membersWith: (permissions: Permission[]) => Promise<Recipient[]>;
  /** One unread notification per user, for the dashboard counter. */
  notify: (userIds: string[], type: EmailEvent, requestId: string) => Promise<void>;
  /** A request, with its document's titles and its client, or null. */
  requestInfo: (id: string) => Promise<RequestInfo | null>;
  /** A member's name, for the recommendation email. */
  memberName: (userId: string) => Promise<string>;
  addRecommendation: (row: {
    requestId: string;
    memberId: string;
    recommendation: DocumentRecommendation;
    note: string | null;
  }) => Promise<void>;
  /** `decide_document_request`. Returns the linked consultation, if any. */
  decide: (
    requestId: string,
    decidedBy: string,
    decision: DecideDocumentRequestDecision,
    expiresAt: string | null,
  ) => Promise<{ consultationId: string | null }>;
  /** `revoke_document_request`. */
  revoke: (requestId: string, decidedBy: string) => Promise<void>;
};

/** Queues one email (`lib/email/queue`). False when it couldn't be queued. */
export type QueueEmail = <Event extends EmailEvent>(input: {
  event: Event;
  to: { email: string; locale: Locale };
  payload: EmailPayload<Event>;
}) => Promise<boolean>;

/** Queues one email per member holding a permission, with their notifications. */
export type QueueEmailForPermission = <Event extends EmailEvent>(
  event: Event,
  permission: Permission,
  payload: EmailPayload<Event>,
  target?: { entity: string; entityId: string },
) => Promise<boolean>;

export type DocumentRequestDeps = {
  locale: Locale;
  userId: string;
  store: DocumentRequestStore;
  audit: (entry: AuditEntry) => Promise<void>;
  queueEmail: QueueEmail;
  queueEmailForPermission: QueueEmailForPermission;
};

type Result<Body> = { status: number; body: Body } | RouteError;

/** Runs a store call, turning a known refusal into its answer. */
async function refusalOr<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: RouteError }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof DocumentRequestError) return { ok: false, error: error.answer };
    throw error;
  }
}

/** Emails never fail the action that caused them (§6.21): log a code and go on. */
async function quietly(label: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch {
    console.error(`document requests: ${label} not queued`);
  }
}

/** Who hears of a new request: the admin and every member who can recommend (§6.21). */
const NEW_REQUEST_PERMISSIONS: Permission[] = [
  EMAIL_ADMIN_PERMISSION,
  PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
];

/**
 * `POST /api/document-requests`, after the session check (§6.18 step 1). The
 * caller needs a profile, which onboarding only makes after the email is
 * verified; `request_document` refuses anyone who isn't an active client and
 * any document that isn't published, and merges a duplicate into the open or
 * granted request. Only new rows send the `document_request` email.
 */
export async function createDocumentRequests(
  rawBody: unknown,
  deps: DocumentRequestDeps,
): Promise<Result<CreateDocumentRequestResponse>> {
  const body = createDocumentRequestSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, deps.locale);

  const profile = await deps.store.ownProfile();
  if (!profile) return requestError("profile_incomplete", 422, "profileIncomplete", deps.locale);

  const requested = await refusalOr(() =>
    deps.store.request(deps.userId, body.data.documentIds, body.data.purpose),
  );
  if (!requested.ok) return requested.error;
  const rows = requested.value;

  const created = rows.filter((row) => !row.merged);
  if (created.length > 0) {
    await quietly("document_request", async () => {
      const [titles, team] = await Promise.all([
        deps.store.documentTitles(created.map((row) => row.documentId)),
        deps.store.membersWith(NEW_REQUEST_PERMISSIONS),
      ]);
      // Each request on its own: a failure for one never skips the next.
      for (const row of created) {
        await quietly("document_request", async () => {
          const documentTitle = titles.get(row.documentId);
          if (!documentTitle) return;
          for (const member of team) {
            await deps.queueEmail({
              event: "document_request",
              to: member,
              payload: { documentTitle, clientName: profile.fullName },
            });
          }
          await deps.store.notify(
            team.map((member) => member.userId),
            "document_request",
            row.requestId,
          );
        });
      }
    });
  }

  return { status: 200, body: { requestIds: rows.map((row) => row.requestId) } };
}

/** The request id from the path, or null when it isn't a uuid. */
function requestIdOf(raw: unknown): string | null {
  const parsed = uuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * `POST /api/admin/document-requests/:id/recommend`, after the
 * `document_requests.recommend` check (§6.18 step 3). Only on an open request:
 * the decision is Ahmed's alone, so a recommendation after it means nothing.
 */
export async function recommendDocumentRequest(
  rawId: unknown,
  rawBody: unknown,
  deps: DocumentRequestDeps,
): Promise<Result<OkResponse>> {
  const id = requestIdOf(rawId);
  const body = recommendDocumentRequestSchema.safeParse(rawBody);
  if (!id || !body.success) return baseError("validation_failed", 400, deps.locale);

  const info = await deps.store.requestInfo(id);
  if (!info) return requestError("not_found", 404, "requestNotFound", deps.locale);
  if (info.status !== "pending_review" && info.status !== "in_contact") {
    return requestError("conflict", 409, "requestNotOpen", deps.locale);
  }

  await deps.store.addRecommendation({
    requestId: id,
    memberId: deps.userId,
    recommendation: body.data.recommendation,
    note: body.data.note ?? null,
  });
  await deps.audit({
    actorId: deps.userId,
    action: "document_request.recommend",
    entity: "document_requests",
    entityId: id,
    metadata: { recommendation: body.data.recommendation },
  });

  await quietly("document_recommendation", async () => {
    // The check above doesn't lock the row, so a decision can land between it
    // and the insert. The recommendation is advisory and stays on record; the
    // admin is told only while the request is still open.
    const now = await deps.store.requestInfo(id);
    if (now?.status !== "pending_review" && now?.status !== "in_contact") return;
    await deps.queueEmailForPermission(
      "document_recommendation",
      EMAIL_ADMIN_PERMISSION,
      {
        documentTitle: info.documentTitle,
        memberName: await deps.store.memberName(deps.userId),
      },
      { entity: "document_requests", entityId: id },
    );
  });
  return { status: 200, body: { ok: true } };
}

/**
 * `POST /api/admin/document-requests/:id/decide`, after the
 * `document_requests.decide` check (§6.18 steps 4 and 5). `grant` and
 * `contact_first` go to `decide_document_request`; `withdraw` to
 * `revoke_document_request`, which works only on a granted request. There is
 * no reject: the schema refuses every other decision.
 */
export async function decideDocumentRequest(
  rawId: unknown,
  rawBody: unknown,
  deps: DocumentRequestDeps,
): Promise<Result<OkResponse>> {
  const id = requestIdOf(rawId);
  const body = decideDocumentRequestSchema.safeParse(rawBody);
  if (!id || !body.success) return baseError("validation_failed", 400, deps.locale);
  const decision = body.data;

  if (decision.decision === "withdraw") {
    const revoked = await refusalOr(() => deps.store.revoke(id, deps.userId));
    if (!revoked.ok) return revoked.error;
    await deps.audit({
      actorId: deps.userId,
      action: "document_request.revoke",
      entity: "document_requests",
      entityId: id,
      metadata: {},
    });
    return { status: 200, body: { ok: true } };
  }

  const expiresAt = decision.decision === "grant" ? (decision.expiresAt ?? null) : null;
  const decided = await refusalOr(() =>
    deps.store.decide(id, deps.userId, decision.decision, expiresAt),
  );
  if (!decided.ok) return decided.error;

  if (decision.decision === "contact_first") {
    // The chat is the consultation the function made or reused. No message
    // is posted and no email is sent: Ahmed writes first, from the chat.
    await deps.audit({
      actorId: deps.userId,
      action: "document_request.contact_first",
      entity: "document_requests",
      entityId: id,
      metadata: { consultationId: decided.value.consultationId },
    });
    return { status: 200, body: { ok: true } };
  }

  // The grant is committed. The client's notice is queued first, so a failed
  // audit write (which fails the response) can't also lose it: a retry would
  // get 409, and nothing else would send it.
  await quietly("document_granted", async () => {
    const info = await deps.store.requestInfo(id);
    if (!info) return;
    await deps.queueEmail({
      event: "document_granted",
      to: info.client,
      payload: { documentTitle: info.documentTitle },
    });
  });
  await deps.audit({
    actorId: deps.userId,
    action: "document_request.grant",
    entity: "document_requests",
    entityId: id,
    metadata: { expires: expiresAt !== null },
  });
  return { status: 200, body: { ok: true } };
}
