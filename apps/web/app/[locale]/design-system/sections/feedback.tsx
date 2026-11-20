import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: Dialog, EmptyState, ErrorState, NotFound, Notice.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.feedback` in messages.
 */
export async function FeedbackSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="feedback" title={t("feedback.title")} note={t("pending")} />;
}
