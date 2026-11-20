import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: Hero, QuietStat, ExpertiseArea, Audience, ServiceList, ServicePage, Qualifications, CareerTimeline, Testimonial, OrganizationLogos.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.contentIdentity` in messages.
 */
export async function ContentIdentitySection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="content-identity" title={t("contentIdentity.title")} note={t("pending")} />;
}
