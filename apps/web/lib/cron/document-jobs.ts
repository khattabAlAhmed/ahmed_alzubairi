import { createServiceClient } from "@/lib/supabase/service";
import type { CronJob } from "./jobs";

/**
 * The protected-documents lane's hourly jobs (§6.18): expiring grants
 * (`expire_document_grants`), deleting watermarked copies older than an hour.
 * `jobs.ts` spreads this list into `HOURLY_JOBS`, so a job is added here
 * without touching `jobs.ts`. Each job must be safe to run twice at once and
 * log codes only.
 */
export const DOCUMENT_JOBS: CronJob[] = [
  { name: "expireDocumentGrants", run: expireDocumentGrants },
];

/**
 * Every grant whose expiry has passed becomes `expired`, in one statement
 * (`expire_document_grants`): the document leaves the client's account
 * (§6.18 "Expired"). Safe to run twice. Logs the code only.
 */
export async function expireDocumentGrants(): Promise<void> {
  const { error } = await createServiceClient().rpc("expire_document_grants");
  if (error) throw new Error(`expire_document_grants failed (${error.code || "error"})`);
}
