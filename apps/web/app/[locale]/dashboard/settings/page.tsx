import { PERMISSIONS } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { mediaBase } from "@/components/dashboard/content/data";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { loadSettings } from "@/components/dashboard/settings/data";
import { SettingsForm } from "@/components/dashboard/settings/settings-form";
import { PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

/** Site settings (§6.20): contact channels, social links, the CV. `team.manage` only. */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireTeamMember(params, "/dashboard/settings");
  const access = await sectionAccess(params, PERMISSIONS.TEAM_MANAGE);
  if (!access.allowed) return <Refusal />;

  const [t, messages, saved] = await Promise.all([
    getTranslations("DashboardTrust.settings"),
    getMessages(),
    loadSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} eyebrow={t("eyebrow")} />
      <NextIntlClientProvider locale={access.locale} messages={{ DashboardTrust: messages.DashboardTrust }}>
        <SettingsForm saved={saved} mediaBase={mediaBase()} />
      </NextIntlClientProvider>
    </div>
  );
}
