import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { ErrorCode, ErrorResponse, OkResponse } from "@repo/shared";
import { NextResponse, type NextRequest } from "next/server";
import { planProfileSync } from "@/lib/clerk-webhook/sync";
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

/**
 * `POST /api/clerk/webhook` (§8 System): keeps `profiles.email` and
 * `full_name` in step with Clerk. The signature is the route's only
 * protection (§9), so it is checked before anything is read or written. No
 * Arcjet here: a bot rule would refuse Clerk's servers.
 *
 * Nothing from the payload is ever logged: it holds names and emails.
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

  const plan = planProfileSync(event);
  if (plan.kind === "ignored") return ok();
  if (plan.kind === "invalid") {
    console.error(`${ROUTE}: unreadable user.updated event`);
    return fail("validation_failed");
  }

  // The signature proves Clerk sent this, so the service client writes (§9).
  // A plain overwrite from the event: safe to receive twice. A user with no
  // profile matches no row; onboarding creates it from Clerk later.
  const { error } = await createServiceClient()
    .from("profiles")
    .update(plan.values)
    .eq("clerk_user_id", plan.userId);
  if (error) {
    // A 500 makes Clerk send the event again.
    console.error(`${ROUTE}: update failed`, error.code);
    return fail("internal_error");
  }

  return ok();
}
