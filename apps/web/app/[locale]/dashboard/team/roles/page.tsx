import { PERMISSIONS } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { loadRoles } from "@/components/dashboard/team/data";
import { RoleEditor } from "@/components/dashboard/team/role-editor";
import { TeamHeader } from "@/components/dashboard/team/team-header";
import { requireTeamMember } from "@/lib/auth/gates";

/**
 * Roles and permissions (§5, §6.19): each role with its checklist, and a form
 * that adds a role. The admin role is read-only. `team.manage` only, checked
 * here and by the roles route on every change.
 */
export default async function TeamRolesPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireTeamMember(params, "/dashboard/team/roles");
  const access = await sectionAccess(params, PERMISSIONS.TEAM_MANAGE);
  if (!access.allowed) return <Refusal />;

  const [t, all, roles] = await Promise.all([
    getTranslations("DashboardTeam.roles"),
    getMessages(),
    loadRoles(),
  ]);

  return (
    <div className="space-y-6">
      <TeamHeader current="roles" />
      <p className="max-w-prose text-text-secondary">{t("intro")}</p>
      <NextIntlClientProvider locale={access.locale} messages={{ DashboardTeam: all.DashboardTeam }}>
        <RoleEditor roles={roles} />
      </NextIntlClientProvider>
    </div>
  );
}
