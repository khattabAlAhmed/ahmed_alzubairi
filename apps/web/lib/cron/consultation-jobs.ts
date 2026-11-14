import { cleanupAttachments, createCleanupDb } from "@/lib/attachments/cleanup";
import { createServiceClient } from "@/lib/supabase/service";
import type { CronJob } from "./jobs";

/**
 * The consultation lane's hourly jobs (§6.17): meeting reminders, unfinished
 * uploads. `jobs.ts` spreads this list into `HOURLY_JOBS`, so a job is added
 * here without touching `jobs.ts`. Each job must be safe to run twice at once
 * and log codes only.
 */
export const CONSULTATION_JOBS: CronJob[] = [
  {
    // Abandoned uploads: `uploading` after 2 h 5 min (past the signed URL), unlinked `ready` after 24 hours.
    name: "attachment-cleanup",
    run: async () => {
      await cleanupAttachments(createCleanupDb(createServiceClient()));
    },
  },
];
