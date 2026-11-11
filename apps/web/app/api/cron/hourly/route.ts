import { createHash, timingSafeEqual } from "node:crypto";
import type { CronHourlyResponse, ErrorCode, ErrorResponse } from "@repo/shared";
import { NextResponse, type NextRequest } from "next/server";
import { HOURLY_JOBS, runJobs } from "@/lib/cron/jobs";
import ar from "@/messages/ar.json";

const ROUTE = "POST /api/cron/hourly";
const SECRET_ENV = "CRON_SECRET";

/** A full batch is sent one email at a time, so the run needs the room. */
export const maxDuration = 60;

const STATUS = {
  unauthenticated: 401,
  internal_error: 500,
} as const satisfies Partial<Record<ErrorCode, number>>;

// A scheduler calls this route, so there is no page language to answer in.
function fail(code: keyof typeof STATUS) {
  const body: ErrorResponse = { error: { code, message: ar.Errors[code] } };
  return NextResponse.json(body, { status: STATUS[code] });
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares in constant time. Hashing first makes both sides the same length. */
function sameSecret(given: string, expected: string) {
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * `POST /api/cron/hourly` (§8 System): runs the hourly jobs. `CRON_SECRET` is
 * the route's only protection (§9), so it is checked before any work. No
 * Arcjet here: a bot rule would refuse the scheduler.
 *
 * Safe to run twice at once: every job is.
 */
export async function POST(request: NextRequest) {
  // Read at request time, so the build passes without it. Never a pass.
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    console.error(`${ROUTE}: ${SECRET_ENV} is not set`);
    return fail("internal_error");
  }

  const header = request.headers.get("authorization");
  if (!header || !sameSecret(header, `Bearer ${secret}`)) {
    return fail("unauthenticated");
  }

  const body: CronHourlyResponse = await runJobs(HOURLY_JOBS);
  return NextResponse.json(body);
}
