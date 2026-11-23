import { DEFAULT_PAGE_SIZE } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Refusal } from "@/components/dashboard/refusal";
import { loadCustomRequests, parseRequestParams, trainingAccess } from "@/components/dashboard/training/data";
import { requestsPath, REQUESTS_PATH } from "@/components/dashboard/training/format";
import { Paging } from "@/components/dashboard/training/paging";
import { RequestList } from "@/components/dashboard/training/request-list";
import { TrainingNav } from "@/components/dashboard/training/section-nav";
import { Button, ButtonLink, Card, PageHeader, TextField } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Custom training requests (§6.7, §6.20), newest first. Opens with
 * `training.manage`; the rows are read with the member's own client, so RLS
 * checks it again. Read only, and every value is shown as text.
 */
export default async function RequestsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  await requireTeamMember(params, "/dashboard/training/requests");
  const access = await trainingAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const list = parseRequestParams(await searchParams);
  const [t, all, { requests, total }] = await Promise.all([
    getTranslations("DashboardTraining"),
    getMessages(),
    loadCustomRequests(list),
  ]);
  const filtered = Boolean(list.search);
  const pages = Math.max(1, Math.ceil(total / list.pageSize));
  const link = (page: number) => requestsPath({ page, pageSize: list.pageSize, search: list.search });
  if (list.page > pages) redirect(`/${locale}${link(pages)}`);

  return (
    <div className="space-y-6">
      <PageHeader title={t("requests.title")} intro={t("requests.intro")} />
      <TrainingNav current="requests" />

      <form
        key={list.search ?? ""}
        method="get"
        role="search"
        aria-label={t("filters.label")}
        className="flex flex-wrap items-start gap-3"
      >
        {list.pageSize !== DEFAULT_PAGE_SIZE && <input type="hidden" name="pageSize" value={list.pageSize} />}
        <TextField
          label={t("filters.search")}
          hint={t("requests.searchHint")}
          name="search"
          type="search"
          defaultValue={list.search ?? ""}
          maxLength={200}
          className="min-w-0 flex-1 basis-64"
        />
        {/* The label's line and its gap, so the buttons sit level with the fields. */}
        <div className="mt-6 flex gap-2">
          <Button type="submit" variant="secondary">
            {t("filters.apply")}
          </Button>
          {filtered && (
            <ButtonLink href={REQUESTS_PATH} variant="quiet">
              {t("filters.clear")}
            </ButtonLink>
          )}
        </div>
      </form>

      <p role="status" className="text-sm text-ink-2">
        {t("requests.count", { total })}
      </p>

      {requests.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{filtered ? t("requests.emptyFiltered") : t("requests.empty")}</h2>
        </Card>
      ) : (
        <NextIntlClientProvider locale={locale} messages={{ DashboardTraining: all.DashboardTraining }}>
          <RequestList requests={requests} locale={locale} />
        </NextIntlClientProvider>
      )}

      <Paging page={list.page} pages={pages} link={link} />
    </div>
  );
}
