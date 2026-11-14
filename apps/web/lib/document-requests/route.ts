import "server-only";
import { auth } from "@clerk/nextjs/server";
import { PERMISSIONS, type Locale, type Permission } from "@repo/shared";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/admin/audit";
import {
  baseError,
  requirePermission,
  type PermissionDeps,
} from "@/lib/admin/permissions";
import { localeFromReferer } from "@/lib/auth/paths";
import { queueEmail, queueEmailForPermission } from "@/lib/email/queue";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import {
  createDocumentRequests,
  decideDocumentRequest,
  recommendDocumentRequest,
  type DocumentRequestDeps,
  type DocumentRequestStore,
} from "./handlers";
import { createDocumentRequestStore } from "./store";

export type DocumentRequestRouteDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  permission?: PermissionDeps;
  /** Called only after the identity (and, for the team, permission) check. */
  createStore: (scope: { userId: string; locale: Locale }) => DocumentRequestStore;
} & Pick<DocumentRequestDeps, "audit" | "queueEmail" | "queueEmailForPermission">;

const defaultDeps: DocumentRequestRouteDeps = {
  getUserId: async () => (await auth()).userId,
  createStore: (scope) =>
    createDocumentRequestStore(createUserClient(), createServiceClient(), scope),
  audit: (entry) => writeAudit(entry),
  queueEmail,
  queueEmailForPermission,
};

function answer(result: { status: number; body: unknown }) {
  return NextResponse.json(result.body, { status: result.status });
}

function internalError(label: string, error: unknown, locale: Locale) {
  // The error's message only: codes, never row data or the request body.
  console.error(label, error instanceof Error ? error.message : "error");
  return answer(baseError("internal_error", 500, locale));
}

/** `POST /api/document-requests`: any signed-in user; the function checks it's a client. */
export async function handleCreateDocumentRequests(
  request: Request,
  deps: DocumentRequestRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const userId = await deps.getUserId();
    if (!userId) return answer(baseError("unauthenticated", 401, locale));
    const body: unknown = await request.json().catch(() => undefined);
    return answer(
      await createDocumentRequests(body, {
        locale,
        userId,
        store: deps.createStore({ userId, locale }),
        audit: deps.audit,
        queueEmail: deps.queueEmail,
        queueEmailForPermission: deps.queueEmailForPermission,
      }),
    );
  } catch (error) {
    return internalError("POST /api/document-requests", error, locale);
  }
}

type TeamHandler = typeof recommendDocumentRequest;

async function handleTeam(
  label: string,
  permission: Permission,
  handler: TeamHandler,
  request: Request,
  rawId: unknown,
  deps: DocumentRequestRouteDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(permission, { locale, deps: deps.permission });
    if (!check.ok) return answer(check);
    const body: unknown = await request.json().catch(() => undefined);
    return answer(
      await handler(rawId, body, {
        locale,
        userId: check.userId,
        store: deps.createStore({ userId: check.userId, locale }),
        audit: deps.audit,
        queueEmail: deps.queueEmail,
        queueEmailForPermission: deps.queueEmailForPermission,
      }),
    );
  } catch (error) {
    return internalError(label, error, locale);
  }
}

/** `POST /api/admin/document-requests/:id/recommend`, with `document_requests.recommend`. */
export function handleRecommend(
  request: Request,
  rawId: unknown,
  deps: DocumentRequestRouteDeps = defaultDeps,
) {
  return handleTeam(
    "POST /api/admin/document-requests/:id/recommend",
    PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
    recommendDocumentRequest,
    request,
    rawId,
    deps,
  );
}

/** `POST /api/admin/document-requests/:id/decide`, with `document_requests.decide` only. */
export function handleDecide(
  request: Request,
  rawId: unknown,
  deps: DocumentRequestRouteDeps = defaultDeps,
) {
  return handleTeam(
    "POST /api/admin/document-requests/:id/decide",
    PERMISSIONS.DOCUMENT_REQUESTS_DECIDE,
    decideDocumentRequest,
    request,
    rawId,
    deps,
  );
}
