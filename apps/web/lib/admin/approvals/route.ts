import "server-only";
import { PERMISSIONS } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import {
  baseError,
  requirePermission,
  type PermissionDeps,
} from "../permissions";
import {
  setApproval,
  type ApprovalEntity,
  type ApprovalStore,
} from "./handlers";
import { createApprovalStore } from "./store";

export type ApprovalRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => ApprovalStore;
  revalidate: (tag: string) => void;
};

const defaultDeps: ApprovalRouteDeps = {
  createStore: () =>
    createApprovalStore(createServiceClient() as unknown as SupabaseClient),
  revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
};

/** `PATCH /api/admin/{testimonials,partners}/:id/approve`, with `testimonials.approve`. */
export async function handleApprovalRequest(
  entity: ApprovalEntity,
  request: Request,
  rawId: unknown,
  deps: ApprovalRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.TESTIMONIALS_APPROVE, {
      locale,
      deps: deps.permission,
    });
    if (!check.ok) {
      return NextResponse.json(check.body, { status: check.status });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const result = await setApproval(entity, rawId, body, {
      locale,
      userId: check.userId,
      store: deps.createStore(),
      revalidate: deps.revalidate,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`PATCH /api/admin/${entity}/:id/approve`, error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
