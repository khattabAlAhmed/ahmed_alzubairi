import type { CronJob } from "./jobs";

/**
 * The consultation lane's hourly jobs (§6.17): meeting reminders, unfinished
 * uploads. `jobs.ts` spreads this list into `HOURLY_JOBS`, so a job is added
 * here without touching `jobs.ts`. Each job must be safe to run twice at once
 * and log codes only.
 */
export const CONSULTATION_JOBS: CronJob[] = [];
