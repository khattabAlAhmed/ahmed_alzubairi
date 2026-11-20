import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: HisSentence, Letter, Signature, WhyITookIt.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.voice` in messages.
 */
export async function VoiceSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="voice" title={t("voice.title")} note={t("pending")} />;
}
