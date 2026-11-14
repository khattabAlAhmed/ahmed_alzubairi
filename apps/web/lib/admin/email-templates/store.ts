import "server-only";
import type { Database } from "@repo/db";
import { emailEventSchema, type EmailTemplate } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailTemplateStore } from "./handlers";

type Client = SupabaseClient<Database>;

/**
 * The saved rows, read with the caller's own token, so RLS decides what comes
 * back (§9): only `team.manage` sees a row.
 */
export async function readSavedTemplates(user: Client): Promise<EmailTemplate[]> {
  const { data, error } = await user
    .from("email_templates")
    .select("event, subject_ar, subject_en, body_ar, body_en");
  if (error) throw new Error(`email_templates read failed: ${error.code}`);
  return data.flatMap((row): EmailTemplate[] => {
    const event = emailEventSchema.safeParse(row.event);
    if (!event.success) return [];
    return [
      {
        event: event.data,
        subjectAr: row.subject_ar,
        subjectEn: row.subject_en,
        bodyAr: row.body_ar,
        bodyEn: row.body_en,
      },
    ];
  });
}

/**
 * `user` reads, under RLS. `service` writes, and only after the route's
 * permission check.
 */
export function createEmailTemplateStore(
  user: Client,
  service: Client,
): EmailTemplateStore {
  return {
    list: () => readSavedTemplates(user),
    async upsert(template) {
      const { error } = await service.from("email_templates").upsert(
        {
          event: template.event,
          subject_ar: template.subjectAr,
          subject_en: template.subjectEn,
          body_ar: template.bodyAr,
          body_en: template.bodyEn,
        },
        { onConflict: "event" },
      );
      if (error) throw new Error(`email_templates upsert failed: ${error.code}`);
    },
    async remove(event) {
      const { error } = await service
        .from("email_templates")
        .delete()
        .eq("event", event);
      if (error) throw new Error(`email_templates delete failed: ${error.code}`);
    },
  };
}
