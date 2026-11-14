import { auth } from "@clerk/nextjs/server";
import { DEFAULT_PAGE_SIZE, PERMISSIONS, teamListParamsSchema } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { loadRoles, loadTeam } from "@/components/dashboard/team/data";
import { InviteForm } from "@/components/dashboard/team/invite-form";
import { listPath, pageCount, parseParams, type RawParams } from "@/components/dashboard/team/list";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { MemberList } from "@/components/dashboard/team/member-list";
import { Paging } from "@/components/dashboard/team/paging";
import { roleName } from "@/components/dashboard/team/permissions";
import { TeamHeader } from "@/components/dashboard/team/team-header";
import { Button, ButtonLink, Card, Select, TextField } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

const BASE = "/dashboard/team";

/**
 * Team members (§6.19, §6.20): the list, pending invitations, the invite
 * form, role changes, disable and enable. `team.manage` only, checked here;
 * the reads go through RLS and every change through the team route.
 */
export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  await requireTeamMember(params, "/dashboard/team");
  const access = await sectionAccess(params, PERMISSIONS.TEAM_MANAGE);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const list = parseParams(
    teamListParamsSchema,
    ["page", "pageSize", "search", "status"],
    await searchParams,
  );
  const [t, all, { userId }, team, roles] = await Promise.all([
    getTranslations("DashboardTeam"),
    getMessages(),
    auth(),
    loadTeam(list, locale),
    loadRoles(),
  ]);
  const pages = pageCount(team.total, list.pageSize);
  const link = (page: number) =>
    listPath(BASE, { search: list.search, status: list.status, pageSize: list.pageSize, page });
  // A page past the end (an old link, or fewer matches now): the last page.
  if (list.page > pages) redirect(`/${locale}${link(pages)}`);
  const filtered = Boolean(list.search || list.status);

  return (
    <div className="space-y-6">
      <TeamHeader current="members" />

      <NextIntlClientProvider locale={locale} messages={{ DashboardTeam: all.DashboardTeam }}>
        <InviteForm roles={roles} />
      </NextIntlClientProvider>

      <Card as="section" aria-labelledby="invitations-title">
        <h2 id="invitations-title" className="text-xl">
          {t("invitations.title")}
        </h2>
        {team.invitations.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">{t("invitations.empty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-text/10">
            {team.invitations.map((invitation) => {
              const role = roles.find((item) => item.id === invitation.roleId);
              return (
                <li
                  key={`${invitation.email}:${invitation.createdAt}`}
                  className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:justify-between sm:gap-4"
                >
                  <bdi dir="ltr" className="break-all">
                    {invitation.email}
                  </bdi>
                  <span className="text-text-secondary">
                    {role ? roleName(role, locale) : t("members.unknownRole")}
                    {" · "}
                    {t("invitations.sent")}:{" "}
                    <LocalTime value={invitation.createdAt} locale={locale} withTime={false} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <section aria-labelledby="members-title" className="space-y-4">
        <h2 id="members-title" className="text-xl">
          {t("members.heading")}
        </h2>
        {/* A plain GET form: the filter lives in the address and works without scripts.
            Keyed by the applied filters: a new address resets the controls to it. */}
        <form
          key={[list.search, list.status].join("|")}
          method="get"
          role="search"
          aria-label={t("members.filters.label")}
          className="flex flex-wrap items-end gap-3"
        >
          {list.pageSize !== DEFAULT_PAGE_SIZE && (
            <input type="hidden" name="pageSize" value={list.pageSize} />
          )}
          <TextField
            label={t("members.filters.search")}
            hint={t("members.filters.searchHint")}
            name="search"
            type="search"
            defaultValue={list.search ?? ""}
            maxLength={200}
            className="min-w-0 flex-1 basis-64"
          />
          <Select
            label={t("members.filters.status")}
            name="status"
            defaultValue={list.status ?? ""}
            className="basis-40"
          >
            <option value="">{t("members.filters.all")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="disabled">{t("status.disabled")}</option>
          </Select>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              {t("members.filters.apply")}
            </Button>
            {filtered && (
              <ButtonLink href={BASE} variant="quiet">
                {t("members.filters.clear")}
              </ButtonLink>
            )}
          </div>
        </form>

        <p role="status" className="text-sm text-text-secondary">
          {t("members.count", { total: team.total })}
        </p>

        {team.members.length === 0 ? (
          <Card>
            <p className="font-semibold">{t("members.empty.title")}</p>
            <p className="mt-1 text-sm text-text-secondary">{t("members.empty.text")}</p>
          </Card>
        ) : (
          <NextIntlClientProvider locale={locale} messages={{ DashboardTeam: all.DashboardTeam }}>
            <MemberList members={team.members} roles={roles} selfId={userId ?? ""} />
          </NextIntlClientProvider>
        )}

        <Paging page={list.page} pages={pages} link={link} />
      </section>
    </div>
  );
}
