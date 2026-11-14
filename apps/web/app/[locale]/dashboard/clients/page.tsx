import { clientListParamsSchema, DEFAULT_PAGE_SIZE } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { clientAccess, loadClients } from "@/components/dashboard/clients/data";
import { Refusal } from "@/components/dashboard/refusal";
import { listPath, pageCount, parseParams, type RawParams } from "@/components/dashboard/team/list";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { Badge, Button, ButtonLink, Card, PageHeader, Select, TextField } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

const BASE = "/dashboard/clients";

/**
 * Client accounts (§6.20). Opens with `clients.view_all`, `consultations.reply`
 * or `training.manage`; the rows come through RLS, so a scoped member sees
 * only their own clients (§5).
 */
export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  await requireTeamMember(params, "/dashboard/clients");
  const access = await clientAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const list = parseParams(
    clientListParamsSchema,
    ["page", "pageSize", "search", "status"],
    await searchParams,
  );
  const [t, { clients, total }] = await Promise.all([
    getTranslations("DashboardClients"),
    loadClients(list),
  ]);
  const pages = pageCount(total, list.pageSize);
  const link = (page: number) =>
    listPath(BASE, { search: list.search, status: list.status, pageSize: list.pageSize, page });
  // A page past the end (an old link, or fewer matches now): the last page.
  if (list.page > pages) redirect(`/${locale}${link(pages)}`);
  const filtered = Boolean(list.search || list.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        intro={access.canManage ? t("intro") : t("scopedIntro")}
      />

      {/* A plain GET form: the filter lives in the address and works without scripts.
          Keyed by the applied filters: a new address (Clear) resets the controls to it. */}
      <form
        key={[list.search, list.status].join("|")}
        method="get"
        role="search"
        aria-label={t("filters.label")}
        className="flex flex-wrap items-end gap-3"
      >
        {list.pageSize !== DEFAULT_PAGE_SIZE && (
          <input type="hidden" name="pageSize" value={list.pageSize} />
        )}
        <TextField
          label={t("filters.search")}
          hint={t("filters.searchHint")}
          name="search"
          type="search"
          defaultValue={list.search ?? ""}
          maxLength={200}
          className="min-w-0 flex-1 basis-64"
        />
        <Select
          label={t("filters.status")}
          name="status"
          defaultValue={list.status ?? ""}
          className="basis-40"
        >
          <option value="">{t("filters.all")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="disabled">{t("status.disabled")}</option>
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
        {t("count", { total })}
      </p>

      {clients.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{filtered ? t("empty.filteredTitle") : t("empty.title")}</h2>
          <p className="mt-2 text-text-secondary">
            {filtered ? t("empty.filteredText") : t("empty.text")}
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface">
          {clients.map((client) => (
            // Every value is rendered as text, never as HTML (§9).
            <li key={client.id} className="relative space-y-1 p-4 hover:bg-text/5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <h2 className="min-w-0 text-base font-semibold break-words">
                  <Link
                    href={`${BASE}/${encodeURIComponent(client.id)}`}
                    aria-label={t("list.open", { name: client.fullName })}
                    className="after:absolute after:inset-0 hover:underline"
                  >
                    <bdi>{client.fullName}</bdi>
                  </Link>
                </h2>
                <Badge tone={client.status === "active" ? "strong" : "neutral"}>
                  {t(`status.${client.status}`)}
                </Badge>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                <bdi dir="ltr" className="break-all">
                  {client.email}
                </bdi>
                <bdi dir="ltr">{client.phone}</bdi>
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                {(client.orgType || client.orgName) && (
                  <span className="min-w-0 wrap-anywhere">
                    {t("list.organization")}:{" "}
                    {client.orgType && t(`orgTypes.${client.orgType}`)}
                    {client.orgType && client.orgName && " · "}
                    {client.orgName && <bdi>{client.orgName}</bdi>}
                  </span>
                )}
                <span>
                  {t("list.language")}: {t(`locales.${client.locale}`)}
                </span>
                <span>
                  {t("list.joined")}:{" "}
                  <LocalTime value={client.createdAt} locale={locale} withTime={false} />
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label={t("paging.label")} className="flex flex-wrap items-center justify-between gap-3">
          {list.page > 1 ? (
            <ButtonLink href={link(list.page - 1)} variant="secondary" size="sm">
              {t("paging.previous")}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-sm text-text-secondary">
            {t("paging.position", { page: list.page, pages })}
          </p>
          {list.page < pages ? (
            <ButtonLink href={link(list.page + 1)} variant="secondary" size="sm">
              {t("paging.next")}
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
