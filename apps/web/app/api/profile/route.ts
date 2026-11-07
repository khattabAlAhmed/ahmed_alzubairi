import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import {
  createProfile,
  internalError,
  type ClerkIdentity,
  type NewProfileRow,
} from "@/lib/profile/create";
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
  };
}

// The route has checked the session and read identity from Clerk by now, so the
// service client writes the row (§9). It only inserts: a second POST never
// overwrites the row, and nothing here can set `role_id` or `status`.
async function insertProfile(row: NewProfileRow) {
  const { error } = await createServiceClient().from("profiles").insert(row);
  if (error?.code === UNIQUE_VIOLATION) return "conflict";
  if (error) throw new Error(`profiles insert failed: ${error.code}`);
  return "created";
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
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST /api/profile", error);
    const result = internalError(locale);
    return NextResponse.json(result.body, { status: result.status });
  }
}
