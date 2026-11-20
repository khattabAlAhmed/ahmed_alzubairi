import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: ConsultationCta, Footer, Header, LanguageAndTheme, MobileMenu, PageHeader, QuickContact, SectionShell, SkipAndConsent.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.shell` in messages.
 */
export async function ShellSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="shell" title={t("shell.title")} note={t("pending")} />;
}
