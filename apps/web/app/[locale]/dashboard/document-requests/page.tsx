import { DEFAULT_PAGE_SIZE, DOCUMENT_REQUEST_STATUSES } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { loadAccessLog } from "@/components/dashboard/documents/data";
import {
  loadDocumentOptions,
  loadRequest,
  loadRequests,
  REQUEST_PAGE_KEYS,
  requestPageParamsSchema,
  requestsAccess,
} from "@/components/dashboard/document-requests/data";
import { RequestDetail, requestTitle } from "@/components/dashboard/document-requests/request-detail";
import { Refusal } from "@/components/dashboard/refusal";
import { listPath, pageCount, parseParams, type RawParams } from "@/components/dashboard/team/list";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { Button, ButtonLink, Card, PageHeader, Select, TextField } from "@/components/ui";
import { StatusPill } from "@/components/workspace";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

const BASE = "/dashboard/document-requests";

/**
 * Document requests (§6.18, §6.20). Opens with `document_requests.recommend`;
 * the rows come through RLS. `?request=<id>` opens one request, where the
 * decision controls show only with `document_requests.decide`.
 */
export default async function DocumentRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  await requireTeamMember(params, "/dashboard/document-requests");
  const access = await requestsAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const list = parseParams(requestPageParamsSchema, REQUEST_PAGE_KEYS, await searchParams);
  const filters = {
    search: list.search,
    status: list.status,
    document: list.document,
    pageSize: list.pageSize,
  };
  const [t, all] = await Promise.all([getTranslations("DashboardDocumentRequests"), getMessages()]);
  const messages = { DashboardDocumentRequests: all.DashboardDocumentRequests, Workspace: all.Workspace };

  if (list.request) {
    const request = await loadRequest(list.request);
    const log =
      request && access.canDecide ? await loadAccessLog({ requestId: request.id }) : null;
    return (
      <div className="space-y-6">
        <ButtonLink href={listPath(BASE, { ...filters, page: list.page })} variant="quiet" size="sm">
          {t("detail.back")}
        </ButtonLink>
        <PageHeader title={t("title")} />
        {request ? (
          <NextIntlClientProvider locale={locale} messages={messages}>
            <RequestDetail request={request} locale={locale} canDecide={access.canDecide} log={log} />
          </NextIntlClientProvider>
        ) : (
          <Card as="section" role="alert">
            <p>{t("detail.notFound")}</p>
          </Card>
        )}
      </div>
    );
  }

  const [{ requests, total }, documents] = await Promise.all([
    loadRequests(list),
    loadDocumentOptions(),
  ]);
  const pages = pageCount(total, list.pageSize);
  const link = (page: number) => listPath(BASE, { ...filters, page });
  // A page past the end (an old link, or fewer matches now): the last page.
  if (list.page > pages) redirect(`/${locale}${link(pages)}`);
  const filtered = Boolean(list.search || list.status || list.document);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} />

      {/* A plain GET form: the filter lives in the address and works without scripts.
          Keyed by the applied filters: a new address (Clear) resets the controls to it. */}
      <form
        key={[list.search, list.status, list.document].join("|")}
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
          className="min-w-0 basis-44"
        >
          <option value="">{t("filters.all")}</option>
          {DOCUMENT_REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {all.Workspace.status.documentRequest[status]}
            </option>
          ))}
        </Select>
        <Select
          label={t("filters.document")}
          name="document"
          defaultValue={list.document ?? ""}
          className="min-w-0 max-w-full basis-56"
        >
          <option value="">{t("filters.all")}</option>
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {(locale === "ar" ? document.titleAr : document.titleEn) || t("list.noTitle")}
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
        {t("count", { total })}
      </p>

      {requests.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{filtered ? t("empty.filteredTitle") : t("empty.title")}</h2>
          <p className="mt-2 text-text-secondary">
            {filtered ? t("empty.filteredText") : t("empty.text")}
          </p>
        </Card>
      ) : (
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface">
            {requests.map((request) => {
              const title = requestTitle(request, locale) || t("list.noTitle");
              const client = request.clientName || t("list.noName");
              return (
                // Every value is rendered as text, never as HTML (§9).
                <li key={request.id} className="relative space-y-1 p-4 hover:bg-text/5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <h2 className="min-w-0 text-base font-semibold wrap-anywhere">
                      <Link
                        href={listPath(BASE, { ...filters, page: list.page, request: request.id })}
                        aria-label={t("list.open", { client, document: title })}
                        className="after:absolute after:inset-0 hover:underline"
                      >
                        {title}
                      </Link>
                    </h2>
                    <StatusPill kind="documentRequest" status={request.status} className="self-start" />
                  </div>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                    <bdi className="min-w-0 wrap-anywhere">{client}</bdi>
                    <span>
                      {t("list.requested")}: <LocalTime value={request.createdAt} locale={locale} />
                    </span>
                    <span>{t("list.recommendations", { count: request.recommendations.length })}</span>
                  </p>
                  <p className="line-clamp-2 max-w-prose text-sm wrap-anywhere">{request.purpose}</p>
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
