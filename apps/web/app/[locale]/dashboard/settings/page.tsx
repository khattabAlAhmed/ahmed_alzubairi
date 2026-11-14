import { PERMISSIONS } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { mediaBase } from "@/components/dashboard/content/data";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { loadSettings } from "@/components/dashboard/settings/data";
import { SettingsForm } from "@/components/dashboard/settings/settings-form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

/** Site settings (§6.20): contact channels, social links, the CV, and the way to the email templates. `team.manage` only. */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireTeamMember(params, "/dashboard/settings");
  const access = await sectionAccess(params, PERMISSIONS.TEAM_MANAGE);
  if (!access.allowed) return <Refusal />;

  const [t, templates, messages, saved] = await Promise.all([
    getTranslations("DashboardTrust.settings"),
    getTranslations("DashboardEmailTemplates.settingsLink"),
    getMessages(),
    loadSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} eyebrow={t("eyebrow")} />
      <NextIntlClientProvider locale={access.locale} messages={{ DashboardTrust: messages.DashboardTrust }}>
        <SettingsForm saved={saved} mediaBase={mediaBase()} />
      </NextIntlClientProvider>
      <Card as="section" compact aria-labelledby="email-templates-heading" className="space-y-3">
        <h2 id="email-templates-heading" className="text-lg">
          {templates("heading")}
        </h2>
        <p className="text-sm text-text-secondary">{templates("text")}</p>
        <ButtonLink href="/dashboard/settings/email-templates" variant="secondary" size="sm">
          {templates("open")}
        </ButtonLink>
      </Card>
    </div>
  );
}
