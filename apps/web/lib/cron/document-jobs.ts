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
  { name: "deleteOldViewCopies", run: deleteOldViewCopies },
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

/** Where the open route writes watermarked copies (§7). */
export const VIEW_COPIES_BUCKET = "document-views";

/** A copy older than this is deleted: its 60-second link is long dead. */
export const VIEW_COPY_MAX_AGE_MS = 60 * 60 * 1000;

/** Objects one Storage list call returns. */
export const VIEW_COPY_PAGE_SIZE = 1000;

/**
 * Deletes every `document-views` object older than an hour (§6.18). The copies
 * sit at the bucket's root, named `<uuid>.<ext>`. The list is read oldest
 * first, a page at a time, and stops at the first copy young enough to keep.
 * Safe to run twice at once: deleting a missing object is not an error.
 */
export async function deleteOldViewCopies(now: Date = new Date()): Promise<void> {
  const copies = createServiceClient().storage.from(VIEW_COPIES_BUCKET);
  const cutoff = now.getTime() - VIEW_COPY_MAX_AGE_MS;
  for (;;) {
    const { data, error } = await copies.list("", {
      limit: VIEW_COPY_PAGE_SIZE,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw new Error(`document-views list failed (${error.name || "error"})`);
    const old = data
      // A folder entry has no id or date; there are none, but skip them.
      .filter(
        (object) =>
          object.id !== null &&
          object.created_at !== null &&
          Date.parse(object.created_at) < cutoff,
      )
      .map((object) => object.name);
    if (old.length > 0) {
      const removed = await copies.remove(old);
      if (removed.error) throw new Error(`document-views remove failed (${removed.error.name || "error"})`);
    }
    // A short page, or a young copy in this one: nothing older is left.
    if (data.length < VIEW_COPY_PAGE_SIZE || old.length < data.length) return;
  }
}
