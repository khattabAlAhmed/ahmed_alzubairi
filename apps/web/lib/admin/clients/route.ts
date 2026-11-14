import "server-only";
import { auth } from "@clerk/nextjs/server";
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
import { createClerkBan, type ClerkBan } from "./clerk-ban";
import { listClients, updateClient, type ClientStore } from "./handlers";
import { createClientStore } from "./store";

export type ClientRouteDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  permission?: PermissionDeps;
  /** Called only for a signed-in caller. Its writes need the permission check. */
  createStore: () => ClientStore;
  createClerk: () => ClerkBan;
  audit: (entry: AuditEntry) => Promise<void>;
};

const defaultDeps: ClientRouteDeps = {
  getUserId: async () => (await auth()).userId,
  createStore: () =>
    createClientStore(createUserClient(), createServiceClient()),
  createClerk: createClerkBan,
  audit: (entry) => writeAudit(entry),
};

/**
 * `GET /api/admin/clients`: any active team member, and RLS scopes the rows
 * (§5). `PATCH /api/admin/clients`: `clients.view_all` only.
 */
export async function handleClientsRequest(
  request: Request,
  deps: ClientRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    if (request.method === "GET") {
      const userId = await deps.getUserId();
      if (!userId) {
        const refused = baseError("unauthenticated", 401, locale);
        return NextResponse.json(refused.body, { status: refused.status });
      }
      const query = Object.fromEntries(new URL(request.url).searchParams);
      const result = await listClients(query, {
        locale,
        userId,
        store: deps.createStore(),
      });
      return NextResponse.json(result.body, { status: result.status });
    }

    const check = await requirePermission(PERMISSIONS.CLIENTS_VIEW_ALL, {
      locale,
      deps: deps.permission,
    });
    if (!check.ok) {
      return NextResponse.json(check.body, { status: check.status });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const result = await updateClient(body, {
      locale,
      userId: check.userId,
      store: deps.createStore(),
      clerk: deps.createClerk(),
      audit: deps.audit,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${request.method} /api/admin/clients`, error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
