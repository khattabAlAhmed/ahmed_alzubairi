import "server-only";
import {
  PERMISSIONS,
  UPLOAD_TARGET_RULES,
  uuidSchema,
  type Locale,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  adminError,
  baseError,
  requirePermission,
  type PermissionDeps,
} from "@/lib/admin/permissions";
import { createServiceClient } from "@/lib/supabase/service";

/** A source letter's signed URL lasts 60 seconds (§9). */
export const LETTER_URL_SECONDS = 60;

/** The `internal` bucket, where `letter` uploads go. Never public. */
const LETTER_BUCKET = UPLOAD_TARGET_RULES.letter.bucket;

export type LetterStore = {
  /** The testimonial's `letter_path`, null when it has none, undefined when there's no such row. */
  letterPath: (id: string) => Promise<string | null | undefined>;
  /** A signed URL for the letter that lasts `seconds`. */
  signedUrl: (path: string, seconds: number) => Promise<string>;
};

export type LetterDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => LetterStore;
};

/** The service client, created only after the permission check passed. */
function createLetterStore(service: SupabaseClient): LetterStore {
  return {
    async letterPath(id) {
      const { data, error } = await service
        .from("testimonials")
        .select("letter_path")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`testimonials read failed: ${error.code}`);
      if (!data) return undefined;
      return typeof data.letter_path === "string" && data.letter_path !== ""
        ? data.letter_path
        : null;
    },
    async signedUrl(path, seconds) {
      const { data, error } = await service.storage
        .from(LETTER_BUCKET)
        .createSignedUrl(path, seconds);
      if (error) throw new Error(`createSignedUrl failed: ${error.message}`);
      return data.signedUrl;
    },
  };
}

const defaultDeps: LetterDeps = {
  createStore: () =>
    createLetterStore(createServiceClient() as unknown as SupabaseClient),
};

const NO_STORE = { "cache-control": "no-store, private" };

function json(error: { status: number; body: unknown }) {
  return NextResponse.json(error.body, { status: error.status, headers: NO_STORE });
}

/**
 * Opens a testimonial's source letter (§6.11): checks `content.manage` or
 * `testimonials.approve` on the server, then redirects to a signed URL that expires in 60 seconds. The
 * letter's path is only ever read here, on the server, and never sent to the
 * browser as data.
 */
export async function openLetter(
  rawId: string | null,
  locale: Locale,
  deps: LetterDeps = defaultDeps,
): Promise<Response> {
  try {
    // Editors attach letters; the admin reads them before approving.
    let check = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
      locale,
      deps: deps.permission,
    });
    if (!check.ok && check.status === 403) {
      check = await requirePermission(PERMISSIONS.TESTIMONIALS_APPROVE, {
        locale,
        deps: deps.permission,
      });
    }
    if (!check.ok) return json(check);

    const id = uuidSchema.safeParse(rawId);
    if (!id.success) return json(adminError("not_found", 404, "notFound", locale));

    const store = deps.createStore();
    const path = await store.letterPath(id.data);
    if (!path) return json(adminError("not_found", 404, "notFound", locale));

    const url = await store.signedUrl(path, LETTER_URL_SECONDS);
    return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
  } catch (error) {
    console.error("GET dashboard/testimonials/letter", error);
    return json(baseError("internal_error", 500, locale));
  }
}
