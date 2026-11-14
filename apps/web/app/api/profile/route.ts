import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { EMAIL_ADMIN_PERMISSION } from "@repo/shared";
import { invitedRoleId, type RoleRef } from "@/lib/admin/team/rules";
import { localeFromReferer } from "@/lib/auth/paths";
import { queueEmailForPermission } from "@/lib/email/queue";
import {
  createProfile,
  internalError,
  type ClerkIdentity,
  type NewProfileRow,
} from "@/lib/profile/create";
import { writeOwnProfile } from "@/lib/profile/read";
import { updateProfile } from "@/lib/profile/update";
import { createServiceClient } from "@/lib/supabase/service";

// Postgres: a row with this primary key already exists.
const UNIQUE_VIOLATION = "23505";

async function getIdentity(userId: string): Promise<ClerkIdentity> {
  const user = await (await clerkClient()).users.getUser(userId);
  const email = user.primaryEmailAddress;
  return {
    fullName: user.fullName,
    verifiedEmail:
      email?.verification?.status === "verified" ? email.emailAddress : null,
    invitedRoleId: invitedRoleId(user.publicMetadata),
  };
}

// The route has checked the session and read identity from Clerk by now, so the
// service client writes the row (§9). It only inserts: a second POST never
// overwrites the row, and nothing here can set `status`. `role_id` comes from
// the invitation Clerk recorded, never from the request.
async function insertProfile(row: NewProfileRow) {
  const { error } = await createServiceClient().from("profiles").insert(row);
  if (error?.code === UNIQUE_VIOLATION) return "conflict";
  if (error) throw new Error(`profiles insert failed: ${error.code}`);
  return "created";
}

// The new user can't read `roles` (RLS), so the service client does, for the
// one id the invitation named.
async function getRole(roleId: string): Promise<RoleRef | null> {
  const { data, error } = await createServiceClient()
    .from("roles")
    .select("id, key")
    .eq("id", roleId)
    .maybeSingle();
  if (error) throw new Error(`role read failed: ${error.code}`);
  return data;
}

function queueNewClientEmail(clientName: string) {
  return queueEmailForPermission("account_new", EMAIL_ADMIN_PERMISSION, {
    clientName,
  });
}

export async function POST(request: Request) {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const { userId } = await auth();
    const result = await createProfile({
      userId,
      locale,
      readBody: () => request.json(),
      getIdentity,
      insertProfile,
      getRole,
      queueNewClientEmail,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST /api/profile", error);
    const result = internalError(locale);
    return NextResponse.json(result.body, { status: result.status });
  }
}

/**
 * `PATCH /api/profile`: the signed-in user changes their own details. The id
 * comes from the session; the service client writes that one row (§9).
 */
export async function PATCH(request: Request) {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const { userId } = await auth();
    const result = await updateProfile({
      userId,
      locale,
      readBody: () => request.json(),
      write: (id, row) => writeOwnProfile(createServiceClient(), id, row),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PATCH /api/profile", error);
    const result = internalError(locale);
    return NextResponse.json(result.body, { status: result.status });
  }
}
