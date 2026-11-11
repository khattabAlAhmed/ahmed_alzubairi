import "server-only";
import { EMAIL_MAX_ATTEMPTS } from "@repo/shared";
import { createServiceClient } from "@/lib/supabase/service";
import { renderOutboxRow, TemplateReadError, type OutboxRow } from "./render";
import { getMailer } from "./resend";

/**
 * Sends one `email_outbox` row (§6.21). It never throws: the result says what
 * happened, and the row keeps the state for the hourly job.
 *
 * - `sent`: Resend took the email. The row is `sent`, with `sent_at`.
 * - `failed`: this try failed. The row is `failed`, with one more attempt and
 *   an error code in `last_error`.
 * - `skipped`: nothing was tried. The row was already sent, is at
 *   `EMAIL_MAX_ATTEMPTS`, was claimed by another run, or the keys are missing.
 */
export type SendResult = "sent" | "failed" | "skipped";

/** Logs the event and a code only: never an address, a name or a body. */
function logFailure(event: string, code: string) {
  console.error(`email send: ${event} failed (${code})`);
}

/** A short code that is safe to store and log. Never an error's message. */
function safeCode(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value)
    ? value
    : fallback;
}

/**
 * Claims the row by counting the attempt, only if nobody counted one since
 * the row was read. Of two runs holding the same row, one update matches and
 * the other gets nothing back, so only one sends. True when this run holds it.
 */
async function claim(row: OutboxRow): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("email_outbox")
    .update({ attempts: row.attempts + 1 })
    .eq("id", row.id)
    .eq("attempts", row.attempts)
    .neq("status", "sent")
    .lt("attempts", EMAIL_MAX_ATTEMPTS)
    .select("id");
  if (error) {
    logFailure(row.event, safeCode(error.code, "claim_error"));
    return false;
  }
  return data.length === 1;
}

async function markFailed(row: OutboxRow, code: string): Promise<SendResult> {
  logFailure(row.event, code);
  const { error } = await createServiceClient()
    .from("email_outbox")
    .update({ status: "failed", last_error: code })
    .eq("id", row.id)
    // Another run may have sent it meanwhile: a sent row stays sent.
    .neq("status", "sent");
  if (error) logFailure(row.event, safeCode(error.code, "mark_error"));
  return "failed";
}

export async function sendOutboxRow(row: OutboxRow): Promise<SendResult> {
  try {
    if (row.status === "sent" || row.attempts >= EMAIL_MAX_ATTEMPTS) return "skipped";
    const mailer = getMailer();
    if (!mailer) return "skipped";
    if (!(await claim(row))) return "skipped";

    try {
      const email = await renderOutboxRow(row);
      const { error } = await mailer.resend.emails.send(
        {
          from: mailer.from,
          to: row.to_email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        },
        // If a run dies after Resend took the email and before the row is
        // marked, the retry carries the same key and Resend sends nothing new.
        { idempotencyKey: `email-outbox/${row.id}` },
      );
      if (error) return await markFailed(row, safeCode(error.name, "send_error"));
    } catch (error) {
      return await markFailed(
        row,
        error instanceof TemplateReadError
          ? `template_${safeCode(error.code, "error")}`
          : "send_exception",
      );
    }

    const marked = await createServiceClient()
      .from("email_outbox")
      .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
      .eq("id", row.id);
    if (marked.error) logFailure(row.event, safeCode(marked.error.code, "mark_error"));
    return "sent";
  } catch {
    logFailure(row.event, "send_exception");
    return "failed";
  }
}

/** Sends rows one at a time, to stay inside Resend's rate limit. Never throws. */
export async function sendOutboxRows(rows: OutboxRow[]): Promise<void> {
  for (const row of rows) await sendOutboxRow(row);
}
