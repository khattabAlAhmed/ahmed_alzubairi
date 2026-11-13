import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  auditLogListParamsSchema,
  DEFAULT_PAGE_SIZE,
  PERMISSIONS,
} from "@repo/shared";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { AuditList } from "@/components/dashboard/team/audit-list";
import { actionLabel, entityLabel } from "@/components/dashboard/team/audit-labels";
import { loadActors, loadAudit } from "@/components/dashboard/team/data";
import { listPath, pageCount, parseParams, type RawParams } from "@/components/dashboard/team/list";
import { Paging } from "@/components/dashboard/team/paging";
import { TeamHeader } from "@/components/dashboard/team/team-header";
import { Button, ButtonLink, Card, Select } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

const BASE = "/dashboard/team/audit";

/**
 * The audit log (§6.20): newest first, paged, filtered by who, where and
 * what. `team.manage` only, checked here; RLS checks it again on the read.
 */
export default async function TeamAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  await requireTeamMember(params, "/dashboard/team/audit");
  const access = await sectionAccess(params, PERMISSIONS.TEAM_MANAGE);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const list = parseParams(
    auditLogListParamsSchema,
    ["page", "pageSize", "actor", "entity", "action"],
    await searchParams,
  );
  const [t, { DashboardTeam, DashboardContent }, log, actors] = await Promise.all([
    getTranslations("DashboardTeam.audit"),
    getMessages(),
    loadAudit(list),
    loadActors(),
  ]);
  const pages = pageCount(log.total, list.pageSize);
  const link = (page: number) =>
    listPath(BASE, {
      actor: list.actor,
      entity: list.entity,
      action: list.action,
      pageSize: list.pageSize,
      page,
    });
  if (list.page > pages) redirect(`/${locale}${link(pages)}`);
  const filtered = Boolean(list.actor || list.entity || list.action);

  return (
    <div className="space-y-6">
      <TeamHeader current="audit" />
      <p className="max-w-prose text-text-secondary">{t("intro")}</p>

      <form
        method="get"
        role="search"
        aria-label={t("filters.label")}
        className="flex flex-wrap items-end gap-3"
      >
        {list.pageSize !== DEFAULT_PAGE_SIZE && (
          <input type="hidden" name="pageSize" value={list.pageSize} />
        )}
        <Select
          label={t("filters.actor")}
          name="actor"
          defaultValue={list.actor ?? ""}
          className="min-w-0 flex-1 basis-48"
        >
          <option value="">{t("filters.anyActor")}</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </Select>
        <Select
          label={t("filters.entity")}
          name="entity"
          defaultValue={list.entity ?? ""}
          className="min-w-0 flex-1 basis-48"
        >
          <option value="">{t("filters.anyEntity")}</option>
          {AUDIT_ENTITIES.map((entity) => (
            <option key={entity} value={entity}>
              {entityLabel(entity, DashboardTeam.audit.entities, DashboardContent.types)}
            </option>
          ))}
        </Select>
        <Select
          label={t("filters.action")}
          name="action"
          defaultValue={list.action ?? ""}
          className="min-w-0 flex-1 basis-48"
        >
          <option value="">{t("filters.anyAction")}</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {actionLabel(action, DashboardTeam.audit.actions)}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            {t("filters.apply")}
          </Button>
          {filtered && (
            <ButtonLink href={BASE} variant="quiet">
              {t("filters.clear")}
            </ButtonLink>
          )}
        </div>
      </form>

      <p role="status" className="text-sm text-text-secondary">
        {t("count", { total: log.total })}
      </p>

      {log.entries.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{filtered ? t("empty.filteredTitle") : t("empty.title")}</h2>
          <p className="mt-2 text-text-secondary">
            {filtered ? t("empty.filteredText") : t("empty.text")}
          </p>
        </Card>
      ) : (
        <AuditList entries={log.entries} locale={locale} />
      )}

      <Paging page={list.page} pages={pages} link={link} />
    </div>
  );
}
