import "server-only";
import { PERMISSIONS } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import {
  baseError,
  requirePermission,
  type PermissionDeps,
} from "../permissions";
import {
  createContent,
  listContent,
  updateContent,
  type ContentStore,
} from "./handlers";
import { createContentStore } from "./store";

export type ContentMethod = "GET" | "POST" | "PATCH";

export type ContentRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => ContentStore;
  revalidate: (tag: string) => void;
};

const defaultDeps: ContentRouteDeps = {
  createStore: () =>
    createContentStore(
      createUserClient() as unknown as SupabaseClient,
      createServiceClient() as unknown as SupabaseClient,
    ),
  // Expire now: the next visit to a page with this tag gets the new data,
  // never the old page (Next 16: `updateTag` is for Server Actions only).
  revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
};

/** `GET/POST/PATCH /api/admin/content/:type`, with `content.manage`. */
export async function handleContentRequest(
  method: ContentMethod,
  request: Request,
  rawType: unknown,
  deps: ContentRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
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
      revalidate: deps.revalidate,
    };
    const readBody = () => request.json().catch(() => undefined);
    const result =
      method === "GET"
        ? await listContent(rawType, handlerDeps)
        : method === "POST"
          ? await createContent(rawType, await readBody(), handlerDeps)
          : await updateContent(rawType, await readBody(), handlerDeps);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${method} /api/admin/content`, error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
