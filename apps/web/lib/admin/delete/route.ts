import "server-only";
import { PERMISSIONS } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { writeAudit, type AuditEntry } from "@/lib/admin/audit";
import { baseError, requirePermission, type PermissionDeps } from "@/lib/admin/permissions";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteRecord, type DeleteStore } from "./handlers";
import { createDeleteStore } from "./store";

export type DeleteRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => DeleteStore;
  audit: (entry: AuditEntry) => Promise<void>;
  revalidate: (tag: string) => void;
};

const defaultDeps: DeleteRouteDeps = {
  createStore: () => createDeleteStore(createServiceClient() as unknown as SupabaseClient),
  audit: (entry) => writeAudit(entry),
  // Expire now, as the content routes do.
  revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
};

/**
 * `DELETE /api/admin/:type/:id`, with `data.delete`. Also called by static
 * routes that take the same path, such as `/api/admin/consultations/:id`.
 */
export async function handleDeleteRequest(
  request: Request,
  rawType: string,
  rawId: string,
  deps: DeleteRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.DATA_DELETE, { locale, deps: deps.permission });
    if (!check.ok) return NextResponse.json(check.body, { status: check.status });

    const body = await request.json().catch(() => undefined);
    const result = await deleteRecord(rawType, rawId, body, {
      locale,
      userId: check.userId,
      store: deps.createStore(),
      audit: deps.audit,
      revalidate: deps.revalidate,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("DELETE /api/admin/:type/:id", error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
