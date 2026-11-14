import { CONSULTATION_KINDS, CONSULTATION_STATUSES, consultationListParamsSchema, DEFAULT_PAGE_SIZE } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  CONSULTATION_LIST_KEYS,
  consultationsAccess,
  loadConsultations,
  withMine,
} from "@/components/dashboard/consultations/data";
import { Refusal } from "@/components/dashboard/refusal";
import { listPath, pageCount, parseParams, type RawParams } from "@/components/dashboard/team/list";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { Button, ButtonLink, Card, Checkbox, PageHeader, Select, TextField } from "@/components/ui";
import { StatusPill } from "@/components/workspace";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

const BASE = "/dashboard/consultations";

/**
 * Consultations (§6.17, §6.20). Opens with `consultations.view_all` or
 * `consultations.reply`; the rows come through RLS, so an assistant sees only
 * the ones assigned to them.
 */
export default async function ConsultationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  await requireTeamMember(params, "/dashboard/consultations");
  const access = await consultationsAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const raw = await searchParams;
  const list = withMine(parseParams(consultationListParamsSchema, CONSULTATION_LIST_KEYS, raw), raw);
  const filters = {
    search: list.search,
    status: list.status,
    kind: list.kind,
    mine: list.mine ? "1" : undefined,
    pageSize: list.pageSize,
  };
  const [t, all, { consultations, total }] = await Promise.all([
    getTranslations("DashboardConsultations"),
    getMessages(),
    loadConsultations(list, access.userId),
  ]);
  const pages = pageCount(total, list.pageSize);
  const link = (page: number) => listPath(BASE, { ...filters, page });
  // A page past the end (an old link, or fewer matches now): the last page.
  if (list.page > pages) redirect(`/${locale}${link(pages)}`);
  const filtered = Boolean(list.search || list.status || list.kind || list.mine);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} />

      {/* A plain GET form: the filter lives in the address and works without scripts.
          Keyed by the applied filters: a new address (Clear) resets the controls to it. */}
      <form
        key={[list.search, list.status, list.kind, list.mine].join("|")}
        method="get"
        role="search"
        aria-label={t("filters.label")}
        className="flex flex-wrap items-end gap-3"
      >
        {list.pageSize !== DEFAULT_PAGE_SIZE && <input type="hidden" name="pageSize" value={list.pageSize} />}
        <TextField
          label={t("filters.search")}
          hint={t("filters.searchHint")}
          name="search"
          type="search"
          defaultValue={list.search ?? ""}
          maxLength={200}
          className="min-w-0 flex-1 basis-64"
        />
        <Select label={t("filters.status")} name="status" defaultValue={list.status ?? ""} className="min-w-0 basis-44">
          <option value="">{t("filters.all")}</option>
          {CONSULTATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {all.Workspace.status.consultation[status]}
            </option>
          ))}
        </Select>
        <Select label={t("filters.kind")} name="kind" defaultValue={list.kind ?? ""} className="min-w-0 basis-44">
          <option value="">{t("filters.all")}</option>
          {CONSULTATION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kinds.${kind}`)}
            </option>
          ))}
        </Select>
        <Checkbox label={t("filters.mine")} name="mine" value="1" defaultChecked={Boolean(list.mine)} className="pb-2.5" />
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

      {consultations.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{filtered ? t("empty.filteredTitle") : t("empty.title")}</h2>
          <p className="mt-2 text-text-secondary">
            {filtered ? t("empty.filteredText") : access.viewAll ? t("empty.text") : t("empty.assistantText")}
          </p>
        </Card>
      ) : (
        <NextIntlClientProvider locale={locale} messages={{ Workspace: all.Workspace }}>
          <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface">
            {consultations.map((item) => {
              const client = item.clientName || t("list.noName");
              return (
                // Every value is rendered as text, never as HTML (§9).
                <li key={item.id} className="relative space-y-1 p-4 hover:bg-text/5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <h2 dir="auto" className="min-w-0 text-start text-base font-semibold wrap-anywhere">
                      <Link
                        href={`${BASE}/${item.id}`}
                        aria-label={t("list.open", { title: item.title, client })}
                        className="after:absolute after:inset-0 hover:underline"
                      >
                        {item.title}
                      </Link>
                    </h2>
                    <StatusPill kind="consultation" status={item.status} className="self-start" />
                  </div>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                    <span>
                      {t("list.client")}: <bdi className="wrap-anywhere">{client}</bdi>
                    </span>
                    <span>
                      {t("list.assignee")}:{" "}
                      {item.assigneeName === null ? t("list.unassigned") : <bdi>{item.assigneeName}</bdi>}
                    </span>
                    <span>
                      {t("list.opened")}: <LocalTime value={item.createdAt} locale={locale} />
                    </span>
                    {item.kind === "document_request" && <span>{t("kinds.document_request")}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </NextIntlClientProvider>
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
          <p className="text-sm text-text-secondary">{t("paging.position", { page: list.page, pages })}</p>
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
