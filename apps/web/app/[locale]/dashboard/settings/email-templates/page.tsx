import { PERMISSIONS } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { loadEmailTemplates } from "@/components/dashboard/email-templates/data";
import { TemplateBoard } from "@/components/dashboard/email-templates/template-board";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

/** The email template editor (§6.20 Settings, §6.21). `team.manage` only. */
export default async function EmailTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireTeamMember(params, "/dashboard/settings/email-templates");
  const access = await sectionAccess(params, PERMISSIONS.TEAM_MANAGE);
  if (!access.allowed) return <Refusal />;

  const [t, messages, templates] = await Promise.all([
    getTranslations("DashboardEmailTemplates"),
    getMessages(),
    loadEmailTemplates(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        eyebrow={t("eyebrow")}
        actions={
          <ButtonLink href="/dashboard/settings" variant="secondary" size="sm">
            {t("back")}
          </ButtonLink>
        }
      />
      <NextIntlClientProvider
        locale={access.locale}
        messages={{ DashboardEmailTemplates: messages.DashboardEmailTemplates }}
      >
        <TemplateBoard templates={templates} />
      </NextIntlClientProvider>
    </div>
  );
}
