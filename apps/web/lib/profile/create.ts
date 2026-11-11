import {
  createProfileRequestSchema,
  type CreateProfileRequest,
  type CreateProfileResponse,
  type ErrorCode,
  type ErrorResponse,
  type Locale,
} from "@repo/shared";
import { isGrantableRole, type RoleRef } from "@/lib/admin/team/rules";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

const MESSAGES = { ar, en };

const STATUS = {
  unauthenticated: 401,
  validation_failed: 400,
  email_not_verified: 403,
  profile_incomplete: 422,
  conflict: 409,
  internal_error: 500,
} as const satisfies Partial<Record<ErrorCode, number>>;

type ProfileError = keyof typeof STATUS;

/** What the server knows about the user from Clerk, never from the body. */
export type ClerkIdentity = {
  fullName: string | null;
  verifiedEmail: string | null;
  /**
   * The role id a team invitation put in the user's public metadata, or null.
   * Only the server can write public metadata.
   */
  invitedRoleId: string | null;
};

/**
 * The columns onboarding writes. `status` is never among them, and `role_id`
 * comes only from an invitation, never from the body.
 */
export type NewProfileRow = {
  clerk_user_id: string;
  full_name: string;
  email: string;
  phone: string;
  org_type: CreateProfileRequest["orgType"] | null;
  org_name: string | null;
  job_title: string | null;
  locale: Locale;
  timezone: string;
  terms_accepted_at: string;
  role_id: string | null;
};

export type CreateProfileDeps = {
  userId: string | null;
  locale: Locale;
  readBody: () => Promise<unknown>;
  getIdentity: (userId: string) => Promise<ClerkIdentity>;
  /** Inserts only. Returns "conflict" when the user already has a row. */
  insertProfile: (row: NewProfileRow) => Promise<"created" | "conflict">;
  /** The role with this id, or null. Read on the server, after the session check. */
  getRole: (roleId: string) => Promise<RoleRef | null>;
  /** Queues the `account_new` email to the admins. A failure is ignored. */
  queueNewClientEmail: (clientName: string) => Promise<unknown>;
  now?: () => Date;
};

export type CreateProfileResult = {
  status: number;
  body: CreateProfileResponse | ErrorResponse;
};

function fail(code: ProfileError, locale: Locale): CreateProfileResult {
  return {
    status: STATUS[code],
    body: { error: { code, message: MESSAGES[locale].Errors[code] } },
  };
}

/** `POST /api/profile`: creates the user's profile once, from onboarding. */
export async function createProfile(
  deps: CreateProfileDeps,
): Promise<CreateProfileResult> {
  const { userId, locale } = deps;
  if (!userId) {
    return fail("unauthenticated", locale);
  }

  const parsed = createProfileRequestSchema.safeParse(
    await deps.readBody().catch(() => undefined),
  );
  if (!parsed.success) {
    return fail("validation_failed", locale);
  }
  const body = parsed.data;

  const identity = await deps.getIdentity(userId);
  if (!identity.verifiedEmail) {
    return fail("email_not_verified", locale);
  }
  const fullName = identity.fullName?.trim();
  if (!fullName) {
    return fail("profile_incomplete", locale);
  }

  // An invited member gets the invitation's role. An unknown role, or the
  // admin role (§6.19: no code path grants it), leaves a client profile.
  const invitedRole = identity.invitedRoleId
    ? await deps.getRole(identity.invitedRoleId)
    : null;
  const roleId = isGrantableRole(invitedRole) ? invitedRole.id : null;

  const outcome = await deps.insertProfile({
    clerk_user_id: userId,
    full_name: fullName,
    email: identity.verifiedEmail,
    phone: body.phone,
    org_type: body.orgType ?? null,
    org_name: body.orgName ?? null,
    job_title: body.jobTitle ?? null,
    locale: body.locale ?? locale,
    timezone: body.timezone,
    terms_accepted_at: (deps.now?.() ?? new Date()).toISOString(),
    role_id: roleId,
  });
  if (outcome === "conflict") {
    return fail("conflict", locale);
  }

  // A new client only. The profile exists by now, so nothing here may fail it.
  if (roleId === null) {
    await deps.queueNewClientEmail(fullName).catch(() => undefined);
  }

  return { status: 201, body: { ok: true } };
}

export function internalError(locale: Locale): CreateProfileResult {
  return fail("internal_error", locale);
}
