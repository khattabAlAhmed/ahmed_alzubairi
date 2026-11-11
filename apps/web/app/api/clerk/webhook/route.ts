import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { ErrorCode, ErrorResponse, OkResponse } from "@repo/shared";
import { NextResponse, type NextRequest } from "next/server";
import { profileValues, userFromEvent } from "@/lib/clerk-webhook/sync";
import { createServiceClient } from "@/lib/supabase/service";
import ar from "@/messages/ar.json";

const ROUTE = "POST /api/clerk/webhook";
const SECRET_ENV = "CLERK_WEBHOOK_SIGNING_SECRET";

const STATUS = {
  validation_failed: 400,
  internal_error: 500,
} as const satisfies Partial<Record<ErrorCode, number>>;

// Clerk's servers call this route, so there is no page language to answer in.
function fail(code: keyof typeof STATUS) {
  const body: ErrorResponse = { error: { code, message: ar.Errors[code] } };
  return NextResponse.json(body, { status: STATUS[code] });
}

function ok() {
  const body: OkResponse = { ok: true };
  return NextResponse.json(body);
}

/** Clerk's Backend API answers 404 for a user it no longer has. */
function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}

/**
 * `POST /api/clerk/webhook` (§8 System): keeps `profiles.email` and
 * `full_name` in step with Clerk. The signature is the route's only
 * protection (§9), so it is checked before anything is read or written. No
 * Arcjet here: a bot rule would refuse Clerk's servers.
 *
 * The event only says which user changed. The name and email are read from
 * Clerk itself, so events that arrive twice or out of order all write Clerk's
 * current values.
 *
 * Nothing from the payload or the user is ever logged: names, emails, ids.
 */
export async function POST(request: NextRequest) {
  // Read at request time, so the build passes without it. Never a pass.
  if (!process.env[SECRET_ENV]) {
    console.error(`${ROUTE}: ${SECRET_ENV} is not set`);
    return fail("internal_error");
  }

  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    console.warn(`${ROUTE}: signature refused`);
    return fail("validation_failed");
  }

  const target = userFromEvent(event);
  if (target.kind === "ignored") return ok();
  if (target.kind === "invalid") {
    console.error(`${ROUTE}: unreadable user.updated event`);
    return fail("validation_failed");
  }

  let user;
  try {
    user = await (await clerkClient()).users.getUser(target.userId);
  } catch (error) {
    // Deleted since the event was sent: nothing to sync.
    if (isNotFound(error)) return ok();
    // A 500 makes Clerk send the event again. The error may name the user.
    console.error(`${ROUTE}: reading the user from Clerk failed`);
    return fail("internal_error");
  }

  const values = profileValues(user);
  if (!values) return ok();

  // The signature proves Clerk sent this, so the service client writes (§9).
  // A plain overwrite with Clerk's current values. A user with no profile
  // matches no row; onboarding creates it from Clerk later.
  const { error } = await createServiceClient()
    .from("profiles")
    .update(values)
    .eq("clerk_user_id", target.userId);
  if (error) {
    // A 500 makes Clerk send the event again.
    console.error(`${ROUTE}: update failed`, error.code);
    return fail("internal_error");
  }

  return ok();
}
