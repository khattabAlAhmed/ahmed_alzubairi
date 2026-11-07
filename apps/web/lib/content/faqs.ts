import "server-only";
import { contentCacheTag, faqCategorySchema, type Locale } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, rowsOrThrow, text } from "./rows";
import type { Faq } from "./types";

/** FAQs in this language, in order (§6.13). Filter by category or service in the page. */
export async function getFaqs(locale: Locale): Promise<Faq[]> {
  "use cache";
  cacheTag(contentCacheTag("faqs"));
  cacheLife("hours");

  const rows = rowsOrThrow(
    await createServiceClient()
      .from("faqs")
      .select("id, category, service_id, question_ar, question_en, answer_ar, answer_en, position, status")
      .eq("status", "published")
      .order("position"),
    "faqs",
  );

  return rows.flatMap((row) => {
    const question = text(row, "question", locale);
    const answer = text(row, "answer", locale);
    const category = faqCategorySchema.safeParse(row.category);
    if (!isPublicIn("faqs", row, locale) || !question || !answer || !category.success) return [];
    return [{ id: row.id, category: category.data, serviceId: row.service_id, question, answer }];
  });
}
