import "server-only";
import { EMAIL_MAX_ATTEMPTS, type CronHourlyResponse } from "@repo/shared";
import { sendOutboxRow } from "@/lib/email/send";
import { createServiceClient } from "@/lib/supabase/service";
import { CONSULTATION_JOBS } from "./consultation-jobs";
import { DOCUMENT_JOBS } from "./document-jobs";

/**
 * The jobs `POST /api/cron/hourly` runs (§8 System). Each job must be safe to
 * run twice at once, and must log codes only: never an address, a name or a
 * body.
 */

/** What a job adds to the route's response. A job may add nothing. */
export type CronJobResult = Partial<CronHourlyResponse>;

export type CronJob = { name: string; run: () => Promise<CronJobResult | void> };

/** Rows one run retries. The rest wait for the next run. */
export const OUTBOX_BATCH_SIZE = 50;

/**
 * A row younger than this is left alone: the request that queued it may still
 * be sending it.
 */
export const OUTBOX_MIN_AGE_MS = 5 * 60 * 1000;

/**
 * Sends the `email_outbox` rows that failed or were never sent (§6.21): not
 * `sent`, under `EMAIL_MAX_ATTEMPTS`, oldest first, one batch per run.
 * `sendOutboxRow` claims each row before it sends, so two runs holding the
 * same row send it once. A row another run claimed is not counted.
 */
export async function retryOutbox(): Promise<CronHourlyResponse> {
  const cutoff = new Date(Date.now() - OUTBOX_MIN_AGE_MS).toISOString();
  const { data, error } = await createServiceClient()
    .from("email_outbox")
    .select("*")
    .neq("status", "sent")
    .lt("attempts", EMAIL_MAX_ATTEMPTS)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(OUTBOX_BATCH_SIZE);
  // The code only: a message may quote row data.
  if (error) throw new Error(`email_outbox not read (${error.code || "error"})`);

  const report: CronHourlyResponse = { retried: 0, sent: 0, failed: 0 };
  // One at a time, to stay inside Resend's rate limit.
  for (const row of data) {
    const result = await sendOutboxRow(row);
    if (result === "skipped") continue;
    report.retried += 1;
    report[result] += 1;
  }
  return report;
}

/**
 * Every hourly job. Each lane adds its own in `consultation-jobs.ts` or
 * `document-jobs.ts`; this list only gathers them.
 */
export const HOURLY_JOBS: CronJob[] = [
  { name: "retryOutbox", run: retryOutbox },
  ...CONSULTATION_JOBS,
  ...DOCUMENT_JOBS,
];

/**
 * Runs the jobs one after another and adds up what they report. A job that
 * throws is logged by name and the next still runs.
 */
export async function runJobs(jobs: CronJob[]): Promise<CronHourlyResponse> {
  const total: CronHourlyResponse = { retried: 0, sent: 0, failed: 0 };
  for (const job of jobs) {
    try {
      const result = await job.run();
      total.retried += result?.retried ?? 0;
      total.sent += result?.sent ?? 0;
      total.failed += result?.failed ?? 0;
    } catch {
      // The name only: an error's message may hold personal data.
      console.error(`cron hourly: job ${job.name} failed`);
    }
  }
  return total;
}
