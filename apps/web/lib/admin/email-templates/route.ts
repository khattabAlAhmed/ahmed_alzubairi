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
  listEmailTemplates,
  resetEmailTemplate,
  updateEmailTemplate,
  type EmailTemplateStore,
} from "./handlers";
import { createEmailTemplateStore } from "./store";

export type EmailTemplatesRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => EmailTemplateStore;
  audit: (entry: AuditEntry) => Promise<void>;
};

const defaultDeps: EmailTemplatesRouteDeps = {
  createStore: () =>
    createEmailTemplateStore(createUserClient(), createServiceClient()),
  audit: (entry) => writeAudit(entry),
};

/** `GET`, `PATCH` and `DELETE /api/admin/email-templates`, each with `team.manage`. */
export async function handleEmailTemplatesRequest(
  request: Request,
  deps: EmailTemplatesRouteDeps = defaultDeps,
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
      const result = await listEmailTemplates(handlerDeps);
      return NextResponse.json(result.body, { status: result.status });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const result =
      request.method === "DELETE"
        ? await resetEmailTemplate(body, handlerDeps)
        : await updateEmailTemplate(body, handlerDeps);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${request.method} /api/admin/email-templates`, error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
