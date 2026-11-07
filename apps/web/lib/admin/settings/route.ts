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
import { updateSetting, type SettingsStore } from "./handlers";
import { createSettingsStore } from "./store";

export type SettingsRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => SettingsStore;
  revalidate: (tag: string) => void;
};

const defaultDeps: SettingsRouteDeps = {
  createStore: () =>
    createSettingsStore(createServiceClient() as unknown as SupabaseClient),
  revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
};

/** `PATCH /api/admin/settings`, with `team.manage`. */
export async function handleSettingsRequest(
  request: Request,
  deps: SettingsRouteDeps = defaultDeps,
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

    const body: unknown = await request.json().catch(() => undefined);
    const result = await updateSetting(body, {
      locale,
      userId: check.userId,
      store: deps.createStore(),
      revalidate: deps.revalidate,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PATCH /api/admin/settings", error);
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
