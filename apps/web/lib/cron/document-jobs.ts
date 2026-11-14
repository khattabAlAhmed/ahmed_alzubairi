import type { CronJob } from "./jobs";

/**
 * The protected-documents lane's hourly jobs (§6.18): expiring grants
 * (`expire_document_grants`), deleting watermarked copies older than an hour.
 * `jobs.ts` spreads this list into `HOURLY_JOBS`, so a job is added here
 * without touching `jobs.ts`. Each job must be safe to run twice at once and
 * log codes only.
 */
export const DOCUMENT_JOBS: CronJob[] = [];
