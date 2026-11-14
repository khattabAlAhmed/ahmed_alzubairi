import {
  updateProfileRequestSchema,
  type ErrorCode,
  type ErrorResponse,
  type Locale,
  type OkResponse,
  type UpdateProfileRequest,
} from "@repo/shared";
import profileAr from "@/messages/ar/AccountProfile.json";
import ar from "@/messages/ar.json";
import profileEn from "@/messages/en/AccountProfile.json";
import en from "@/messages/en.json";

const BASE = { ar: ar.Errors, en: en.Errors };
const OWN = { ar: profileAr.errors, en: profileEn.errors };

export type ProfileResult<T = OkResponse> = { status: number; body: T | ErrorResponse };

/** An error whose text is in the base `Errors` messages. */
export function baseFail(
  code: "unauthenticated" | "validation_failed" | "internal_error",
  status: number,
  locale: Locale,
): ProfileResult<never> {
  return { status, body: { error: { code, message: BASE[locale][code] } } };
}

/** An error whose text is in `AccountProfile.errors`. */
export function ownFail(
  code: ErrorCode,
  status: number,
  key: keyof typeof profileEn.errors,
  locale: Locale,
): ProfileResult<never> {
  return { status, body: { error: { code, message: OWN[locale][key] } } };
}

/** The `profiles` columns a user may change about themselves. Never name, email, role or status. */
export type ProfileUpdateRow = {
  phone?: string;
  org_type?: NonNullable<UpdateProfileRequest["orgType"]>;
  org_name?: string;
  job_title?: string;
  locale?: Locale;
  timezone?: string;
  notify_optional?: boolean;
};

export type UpdateProfileDeps = {
  /** The signed-in user from the session, or null. */
  userId: string | null;
  locale: Locale;
  readBody: () => Promise<unknown>;
  /**
   * Writes `row` to the caller's own profile only. False when they have no
   * profile. Called after the session check, so it may use the service client.
   */
  write: (userId: string, row: ProfileUpdateRow) => Promise<boolean>;
};

/** The request's fields as columns. Only the fields it sent. */
export function toRow(body: UpdateProfileRequest): ProfileUpdateRow {
  const row: ProfileUpdateRow = {};
  if (body.phone !== undefined) row.phone = body.phone;
  if (body.orgType !== undefined) row.org_type = body.orgType;
  if (body.orgName !== undefined) row.org_name = body.orgName;
  if (body.jobTitle !== undefined) row.job_title = body.jobTitle;
  if (body.locale !== undefined) row.locale = body.locale;
  if (body.timezone !== undefined) row.timezone = body.timezone;
  if (body.notifyOptional !== undefined) row.notify_optional = body.notifyOptional;
  return row;
}

/**
 * `PATCH /api/profile`: the caller changes their own details. The schema
 * refuses any other key, so name, email, role and status can't be sent.
 */
export async function updateProfile(deps: UpdateProfileDeps): Promise<ProfileResult> {
  const { userId, locale } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);

  const body = updateProfileRequestSchema.safeParse(await deps.readBody().catch(() => undefined));
  if (!body.success) return baseFail("validation_failed", 400, locale);

  if (!(await deps.write(userId, toRow(body.data)))) {
    return ownFail("not_found", 404, "noProfile", locale);
  }
  return { status: 200, body: { ok: true } };
}
