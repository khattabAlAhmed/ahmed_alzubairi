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
import { createTeamClerk } from "./clerk";
import {
  inviteMember,
  listTeam,
  updateMember,
  type TeamClerk,
  type TeamStore,
} from "./handlers";
import { createTeamStore } from "./store";

export type TeamRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => TeamStore;
  createClerk: () => TeamClerk;
  audit: (entry: AuditEntry) => Promise<void>;
};

const defaultDeps: TeamRouteDeps = {
  createStore: () => createTeamStore(createUserClient(), createServiceClient()),
  createClerk: createTeamClerk,
  audit: (entry) => writeAudit(entry),
};

/** `GET`, `POST` and `PATCH /api/admin/team`, each with `team.manage`. */
export async function handleTeamRequest(
  request: Request,
  deps: TeamRouteDeps = defaultDeps,
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

    const url = new URL(request.url);
    const handlerDeps = {
      locale,
      userId: check.userId,
      store: deps.createStore(),
      clerk: deps.createClerk(),
      audit: deps.audit,
    };

    if (request.method === "GET") {
      const query = Object.fromEntries(url.searchParams);
      const result = await listTeam(query, handlerDeps);
      return NextResponse.json(result.body, { status: result.status });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const result =
      request.method === "POST"
        ? await inviteMember(body, url.origin, handlerDeps)
        : await updateMember(body, handlerDeps);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${request.method} /api/admin/team`, error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
