import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: ConsultationRequest, ContactForm, CustomTrainingRequest, DocumentRequestDialog, NewsletterSignup, Onboarding, SignIn.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.forms` in messages.
 */
export async function FormsSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="forms" title={t("forms.title")} note={t("pending")} />;
}
