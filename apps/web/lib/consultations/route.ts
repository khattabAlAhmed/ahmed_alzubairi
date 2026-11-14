import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { writeAudit, type AuditEntry } from "@/lib/admin/audit";
import { localeFromReferer } from "@/lib/auth/paths";
import { queueEmail, queueEmailForPermission } from "@/lib/email/queue";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { baseFail, type Result } from "./errors";
import {
  createConsultation,
  listConsultations,
  readConsultation,
  sendMessage,
  type ConsultationMail,
} from "./handlers";
import { createConsultationStore, type ConsultationStore } from "./store";

export type ConsultationRouteDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  /** Its writes run only after the handler's identity and permission checks. */
  createStore: () => ConsultationStore;
  mail: ConsultationMail;
  audit: (entry: AuditEntry) => Promise<void>;
};

const defaultDeps: ConsultationRouteDeps = {
  getUserId: async () => (await auth()).userId,
  createStore: () => createConsultationStore(createUserClient(), createServiceClient()),
  mail: { queueEmail, queueEmailForPermission },
  audit: (entry) => writeAudit(entry),
};

type Handler = (input: {
  locale: ReturnType<typeof localeFromReferer>;
  userId: string | null;
  deps: ConsultationRouteDeps;
}) => Promise<Result<unknown>>;

/** Runs a handler and turns its result, or a thrown error, into a response. */
async function respond(
  request: Request,
  label: string,
  deps: ConsultationRouteDeps,
  handler: Handler,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const userId = await deps.getUserId();
    const result = await handler({ locale, userId, deps });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${request.method} ${label}`, error);
    const failure = baseFail("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

const readBody = (request: Request): Promise<unknown> =>
  request.json().catch(() => undefined);

/** `GET /api/consultations` and `POST /api/consultations`. */
export function handleConsultationsRequest(
  request: Request,
  deps: ConsultationRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(request, "/api/consultations", deps, async ({ locale, userId, deps }) => {
    // Signed out, nothing else runs: no store, no body.
    if (!userId) return baseFail("unauthenticated", 401, locale);
    const store = deps.createStore();
    if (request.method === "GET") return listConsultations({ locale, userId, store });
    return createConsultation(await readBody(request), {
      locale,
      userId,
      store,
      mail: deps.mail,
      audit: deps.audit,
    });
  });
}

/** `GET /api/consultations/:id`. */
export function handleConsultationRequest(
  request: Request,
  id: string,
  deps: ConsultationRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(request, "/api/consultations/:id", deps, async ({ locale, userId, deps }) => {
    if (!userId) return baseFail("unauthenticated", 401, locale);
    return readConsultation(id, { locale, userId, store: deps.createStore() });
  });
}

/** `POST /api/consultations/:id/messages`. */
export function handleMessageRequest(
  request: Request,
  id: string,
  deps: ConsultationRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(
    request,
    "/api/consultations/:id/messages",
    deps,
    async ({ locale, userId, deps }) => {
      if (!userId) return baseFail("unauthenticated", 401, locale);
      return sendMessage(id, await readBody(request), {
        locale,
        userId,
        store: deps.createStore(),
        mail: deps.mail,
        audit: deps.audit,
      });
    },
  );
}
