import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import {
  baseError,
  requirePermission,
  type PermissionDeps,
} from "../permissions";
import {
  createUploadUrl,
  finalizeUpload,
  permissionForBody,
  type DetectMime,
  type UploadStore,
} from "./handlers";
import { createUploadStore, detectMimeFromBytes } from "./store";

export type UploadAction = "upload-url" | "finalize";

export type UploadRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => UploadStore;
  detectMime: DetectMime;
};

const defaultDeps: UploadRouteDeps = {
  createStore: () =>
    createUploadStore(createServiceClient() as unknown as SupabaseClient),
  detectMime: detectMimeFromBytes,
};

/** `POST /api/admin/uploads/upload-url` and `/finalize` (§8, §9). */
export async function handleUploadRequest(
  action: UploadAction,
  request: Request,
  deps: UploadRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const body: unknown = await request.json().catch(() => undefined);
    const check = await requirePermission(permissionForBody(body), {
      locale,
      deps: deps.permission,
    });
    if (!check.ok) {
      return NextResponse.json(check.body, { status: check.status });
    }

    const handlerDeps = { locale, store: deps.createStore() };
    const result =
      action === "upload-url"
        ? await createUploadUrl(body, handlerDeps)
        : await finalizeUpload(body, handlerDeps, deps.detectMime);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`POST /api/admin/uploads/${action}`, error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
