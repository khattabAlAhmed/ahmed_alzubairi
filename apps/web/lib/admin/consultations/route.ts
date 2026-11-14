import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { writeAudit, type AuditEntry } from "@/lib/admin/audit";
import { localeFromReferer } from "@/lib/auth/paths";
import { queueEmail } from "@/lib/email/queue";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { baseFail, type Result } from "./errors";
import {
  createMeeting,
  updateConsultation,
  updateMeeting,
  type AdminConsultationDeps,
} from "./handlers";
import { createAdminConsultationStore, type AdminConsultationStore } from "./store";

export type AdminConsultationRouteDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  /** Called only for a signed-in caller. Its writes run after the handler's checks. */
  createStore: () => AdminConsultationStore;
  queueEmail: AdminConsultationDeps["queueEmail"];
  audit: (entry: AuditEntry) => Promise<void>;
};

const defaultDeps: AdminConsultationRouteDeps = {
  getUserId: async () => (await auth()).userId,
  createStore: () => createAdminConsultationStore(createUserClient(), createServiceClient()),
  queueEmail,
  audit: (entry) => writeAudit(entry),
};

async function respond(
  request: Request,
  label: string,
  deps: AdminConsultationRouteDeps,
  handler: (deps: AdminConsultationDeps, body: unknown) => Promise<Result<unknown>>,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const userId = await deps.getUserId();
    // Signed out, nothing else runs: no store, no body.
    const result = userId
      ? await handler(
          { locale, userId, store: deps.createStore(), queueEmail: deps.queueEmail, audit: deps.audit },
          await request.json().catch(() => undefined),
        )
      : baseFail("unauthenticated", 401, locale);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${request.method} ${label}`, error);
    const failure = baseFail("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

/** `PATCH /api/admin/consultations/:id` */
export function handleConsultationPatch(
  request: Request,
  id: string,
  deps: AdminConsultationRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(request, "/api/admin/consultations/:id", deps, (handler, body) =>
    updateConsultation(id, body, handler),
  );
}

/** `POST` and `PATCH /api/admin/consultations/:id/meetings` */
export function handleMeetingsRequest(
  request: Request,
  id: string,
  deps: AdminConsultationRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(request, "/api/admin/consultations/:id/meetings", deps, (handler, body) =>
    request.method === "POST" ? createMeeting(id, body, handler) : updateMeeting(id, body, handler),
  );
}
