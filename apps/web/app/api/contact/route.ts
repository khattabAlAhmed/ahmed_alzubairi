import {
  contactRequestSchema,
  type ErrorCode,
  type ErrorResponse,
  type OkResponse,
} from "@repo/shared";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { protectForm, type FormLimit } from "@/lib/arcjet";
import { createServiceClient } from "@/lib/supabase/service";
import ar from "@/messages/ar/Contact.json";
import en from "@/messages/en/Contact.json";

const MESSAGES = { ar, en };

/** Five messages per IP every ten minutes. */
export const CONTACT_LIMIT: FormLimit = { route: "contact", window: "10m", max: 5 };

const STATUS = {
  validation_failed: 400,
  forbidden: 403,
  rate_limited: 429,
  internal_error: 500,
} as const satisfies Partial<Record<ErrorCode, number>>;

function fail(code: keyof typeof STATUS, request: Request) {
  const locale = localeFromReferer(request.headers.get("referer"));
  const body: ErrorResponse = { error: { code, message: MESSAGES[locale].errors[code] } };
  return NextResponse.json(body, { status: STATUS[code] });
}

/**
 * `POST /api/contact` (§6.14): no account needed. The message is stored as
 * plain text and never rendered as HTML. No email yet (Phase 3).
 */
export async function POST(request: Request) {
  const decision = await protectForm(request, CONTACT_LIMIT);
  if (decision === "rate_limited") return fail("rate_limited", request);
  if (decision === "denied") return fail("forbidden", request);

  const parsed = contactRequestSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return fail("validation_failed", request);
  const { name, email, orgType, subject, message } = parsed.data;

  // Anyone may send a message, and Arcjet has run, so the service client
  // writes it. Visitors have no insert grant on this table (§7).
  const { error } = await createServiceClient()
    .from("contact_messages")
    .insert({ name, email, org_type: orgType, subject, message });
  if (error) {
    // Never log the visitor's details or message.
    console.error("POST /api/contact: insert failed", error.code);
    return fail("internal_error", request);
  }

  const body: OkResponse = { ok: true };
  return NextResponse.json(body, { status: 201 });
}
