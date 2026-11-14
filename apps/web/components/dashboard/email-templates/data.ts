import "server-only";
import { readSavedTemplates } from "@/lib/admin/email-templates/store";
import {
  templateEntries,
  type EmailTemplateEntry,
} from "@/lib/admin/email-templates/templates";
import { createUserClient } from "@/lib/supabase/user";

/**
 * Every event's template for the editor page, read with the member's own
 * client: RLS lets in only `team.manage`. An event with no saved row gets its
 * default copy.
 */
export async function loadEmailTemplates(): Promise<EmailTemplateEntry[]> {
  return templateEntries(await readSavedTemplates(createUserClient()));
}
