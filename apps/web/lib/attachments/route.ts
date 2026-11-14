import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { DetectMime, UploadStore } from "@/lib/admin/uploads/handlers";
import { createUploadStore, detectMimeFromBytes } from "@/lib/admin/uploads/store";
import { localeFromReferer } from "@/lib/auth/paths";
import { createConsultationStore, type ConsultationStore } from "@/lib/consultations/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { baseFail, type Result } from "./errors";
import {
  createAttachmentUploadUrl,
  downloadAttachment,
  finalizeAttachment,
  type AttachmentDeps,
} from "./handlers";
import { createAttachmentStore, type AttachmentStore } from "./store";

export type AttachmentRouteDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  /** Called only for a signed-in caller. */
  createStores: () => {
    consultations: Pick<ConsultationStore, "get" | "hasPermission">;
    attachments: AttachmentStore;
    storage: Pick<UploadStore, "signUpload" | "open" | "remove">;
  };
  detectMime: DetectMime;
};

const defaultDeps: AttachmentRouteDeps = {
  getUserId: async () => (await auth()).userId,
  createStores: () => {
    const user = createUserClient();
    const service = createServiceClient();
    return {
      consultations: createConsultationStore(user, service),
      attachments: createAttachmentStore(user, service),
      storage: createUploadStore(service),
    };
  },
  detectMime: detectMimeFromBytes,
};

/** Runs a handler for a signed-in caller and turns its result, or a throw, into a response. */
async function respond(
  request: Request,
  label: string,
  deps: AttachmentRouteDeps,
  handler: (deps: AttachmentDeps) => Promise<Result<unknown>>,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const userId = await deps.getUserId();
    // Signed out, nothing else runs: no store, no body.
    const result = userId
      ? await handler({ locale, userId, ...deps.createStores() })
      : baseFail("unauthenticated", 401, locale);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${request.method} ${label}`, error);
    const failure = baseFail("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

const readBody = (request: Request): Promise<unknown> => request.json().catch(() => undefined);

/** `POST /api/consultations/:id/attachments/upload-url` */
export function handleUploadUrlRequest(
  request: Request,
  consultationId: string,
  deps: AttachmentRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(request, "/api/consultations/:id/attachments/upload-url", deps, async (handler) =>
    createAttachmentUploadUrl(consultationId, await readBody(request), handler),
  );
}

/** `POST /api/consultations/:id/attachments/finalize` */
export function handleFinalizeRequest(
  request: Request,
  consultationId: string,
  deps: AttachmentRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(request, "/api/consultations/:id/attachments/finalize", deps, async (handler) =>
    finalizeAttachment(consultationId, await readBody(request), handler, deps.detectMime),
  );
}

/** `GET /api/attachments/:id` */
export function handleDownloadRequest(
  request: Request,
  id: string,
  deps: AttachmentRouteDeps = defaultDeps,
): Promise<Response> {
  return respond(request, "/api/attachments/:id", deps, (handler) =>
    downloadAttachment(id, handler),
  );
}
