import "server-only";
import { Resend } from "resend";

/**
 * The only place the app reads the email keys (§9 Secrets). They are read when
 * an email is sent, not when the module loads, so the build and the tests pass
 * without them.
 */

export type Mailer = { resend: Resend; from: string };

let warned = false;

/**
 * The Resend client and the sender address, or null when `RESEND_API_KEY` or
 * `EMAIL_FROM` is missing. Without them nothing is sent: rows stay `pending`
 * for the hourly job, and one warning is logged per server instance.
 */
export function getMailer(): Mailer | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (!warned) {
      warned = true;
      console.warn(
        "email: RESEND_API_KEY or EMAIL_FROM is not set. Emails stay pending in email_outbox.",
      );
    }
    return null;
  }
  return { resend: new Resend(apiKey), from };
}

/** For tests: lets the missing-key warning be logged again. */
export function resetMailerWarning() {
  warned = false;
}
