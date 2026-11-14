import "server-only";
import { PERMISSIONS } from "@repo/shared";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { writeAudit, type AuditEntry } from "../audit";
import {
  baseError,
  requirePermission,
  type PermissionDeps,
} from "../permissions";
import {
  createDocument,
  listDocuments,
  updateDocument,
  type DocumentStore,
} from "./handlers";
import { createDocumentStore } from "./store";

export type DocumentsRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => DocumentStore;
  audit: (entry: AuditEntry) => Promise<void>;
  revalidate: (tag: string) => void;
};

const defaultDeps: DocumentsRouteDeps = {
  createStore: () => createDocumentStore(createUserClient(), createServiceClient()),
  audit: (entry) => writeAudit(entry),
  revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
};

/** `GET`, `POST` and `PATCH /api/admin/documents`, each with `documents.manage` (§8). */
export async function handleDocumentsRequest(
  request: Request,
  deps: DocumentsRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.DOCUMENTS_MANAGE, {
      locale,
      deps: deps.permission,
    });
    if (!check.ok) {
      return NextResponse.json(check.body, { status: check.status });
    }

    const handlerDeps = {
      locale,
      userId: check.userId,
      store: deps.createStore(),
      audit: deps.audit,
      revalidate: deps.revalidate,
    };

    if (request.method === "GET") {
      const result = await listDocuments(handlerDeps);
      return NextResponse.json(result.body, { status: result.status });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const result =
      request.method === "POST"
        ? await createDocument(body, handlerDeps)
        : await updateDocument(body, handlerDeps);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    // The error's message only (codes, never row data or the request body).
    console.error(
      `${request.method} /api/admin/documents`,
      error instanceof Error ? error.message : "error",
    );
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
