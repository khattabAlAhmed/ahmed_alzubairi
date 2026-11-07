import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { ErrorCode, ErrorResponse, Locale, Permission } from "@repo/shared";
import { createUserClient } from "@/lib/supabase/user";
import adminAr from "@/messages/ar/AdminErrors.json";
import ar from "@/messages/ar.json";
import adminEn from "@/messages/en/AdminErrors.json";
import en from "@/messages/en.json";

const BASE = { ar: ar.Errors, en: en.Errors };
const ADMIN = { ar: adminAr, en: adminEn };

type AdminMessageKey = keyof typeof adminEn;

/** An error the admin routes return, with its status and the user's language. */
export type AdminError = { status: number; body: ErrorResponse };

/** An error whose text is in the base `Errors` messages. */
export function baseError(
  code: "unauthenticated" | "validation_failed" | "internal_error",
  status: number,
  locale: Locale,
): AdminError {
  return { status, body: { error: { code, message: BASE[locale][code] } } };
}

/** An error whose text is in the `AdminErrors` namespace. */
export function adminError(
  code: ErrorCode,
  status: number,
  messageKey: AdminMessageKey,
  locale: Locale,
): AdminError {
  return {
    status,
    body: { error: { code, message: ADMIN[locale][messageKey] } },
  };
}

export type PermissionDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  /** `has_permission(key)` for that user, through RLS. */
  hasPermission: (key: Permission) => Promise<boolean>;
};

export type PermissionResult =
  | { ok: true; userId: string }
  | ({ ok: false } & AdminError);

const defaultDeps: PermissionDeps = {
  getUserId: async () => (await auth()).userId,
  hasPermission: async (key) => {
    // The user's own token, so the database decides from their role (§9).
    const { data, error } = await createUserClient().rpc("has_permission", {
      key,
    });
    if (error) throw new Error(`has_permission failed: ${error.code}`);
    return data === true;
  },
};

/**
 * Checks the session, then the permission, on the server. Routes return the
 * error as is; server components redirect or show "not found" on `ok: false`.
 * Takes a `PERMISSIONS` key and never a role name.
 */
export async function requirePermission(
  key: Permission,
  { locale, deps = defaultDeps }: { locale: Locale; deps?: PermissionDeps },
): Promise<PermissionResult> {
  const userId = await deps.getUserId();
  if (!userId) {
    return { ok: false, ...baseError("unauthenticated", 401, locale) };
  }
  if (!(await deps.hasPermission(key))) {
    return { ok: false, ...adminError("forbidden", 403, "forbidden", locale) };
  }
  return { ok: true, userId };
}
