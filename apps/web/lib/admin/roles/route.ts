import "server-only";
import { PERMISSIONS } from "@repo/shared";
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
  createRole,
  listRoles,
  updateRole,
  type RoleStore,
} from "./handlers";
import { createRoleStore } from "./store";

export type RoleRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => RoleStore;
  audit: (entry: AuditEntry) => Promise<void>;
};

const defaultDeps: RoleRouteDeps = {
  createStore: () => createRoleStore(createUserClient(), createServiceClient()),
  audit: (entry) => writeAudit(entry),
};

/** `GET`, `POST` and `PATCH /api/admin/roles`, each with `team.manage`. */
export async function handleRolesRequest(
  request: Request,
  deps: RoleRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.TEAM_MANAGE, {
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
    };

    if (request.method === "GET") {
      const result = await listRoles(handlerDeps);
      return NextResponse.json(result.body, { status: result.status });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const result =
      request.method === "POST"
        ? await createRole(body, handlerDeps)
        : await updateRole(body, handlerDeps);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${request.method} /api/admin/roles`, error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
