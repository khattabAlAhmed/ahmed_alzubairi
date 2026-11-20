import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: AppShell, ChatThread, ContentEditor, DataTable, DocumentViewer, MeetingCard, StatTile.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.workspace` in messages.
 */
export async function WorkspaceSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="workspace" title={t("workspace.title")} note={t("pending")} />;
}
