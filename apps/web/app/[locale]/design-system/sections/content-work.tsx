import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: ProjectStory, ProjectPage, ArticleItem, ArticleBody, ResourceItem, MediaItem, MediaFrame, CourseItem, RegistrationPanel, DocumentItem, FAQ.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.contentWork` in messages.
 */
export async function ContentWorkSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="content-work" title={t("contentWork.title")} note={t("pending")} />;
}
