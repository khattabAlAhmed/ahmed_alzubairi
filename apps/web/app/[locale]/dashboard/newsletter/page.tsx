import { DEFAULT_PAGE_SIZE, NEWSLETTER_STATUSES, PERMISSIONS } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { sectionAccess } from "@/components/dashboard/gate";
import {
  exportPath,
  loadSubscribers,
  newsletterPath,
  parseNewsletterParams,
} from "@/components/dashboard/newsletter/data";
import { SubscriberList } from "@/components/dashboard/newsletter/subscriber-list";
import { Refusal } from "@/components/dashboard/refusal";
import {
  Button,
  buttonClasses,
  ButtonLink,
  Card,
  PageHeader,
  Select,
  TextField,
} from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Newsletter subscribers (§6.15, §6.20). Open with `content.manage`, checked
 * here on the server; the rows are read with the member's own client, so RLS
 * checks it again, and the export route checks it for every download.
 */
export default async function NewsletterPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  await requireTeamMember(params, "/dashboard/newsletter");
  const access = await sectionAccess(params, PERMISSIONS.CONTENT_MANAGE);
  if (!access.allowed) return <Refusal />;

  const list = parseNewsletterParams(await searchParams);
  const [t, all, { subscribers, total }] = await Promise.all([
    getTranslations("DashboardNewsletter"),
    getMessages(),
    loadSubscribers(list),
  ]);
  const filtered = Boolean(list.search || list.status);
  const pages = Math.max(1, Math.ceil(total / list.pageSize));
  const link = (page: number) =>
    newsletterPath({
      page,
      pageSize: list.pageSize,
      search: list.search,
      status: list.status,
    });
  // A page past the end (an old link, or fewer matches now): the last page.
  if (list.page > pages) redirect(`/${access.locale}${link(pages)}`);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} />

      {/* A plain GET form: the filter lives in the address and works without scripts. */}
      <form
        // Remounts when the applied filter changes, so "Clear" also resets
        // what was typed but not applied.
        key={[list.search, list.status].join("|")}
        method="get"
        role="search"
        aria-label={t("filters.label")}
        className="flex flex-wrap items-start gap-3"
      >
        {list.pageSize !== DEFAULT_PAGE_SIZE && (
          <input type="hidden" name="pageSize" value={list.pageSize} />
        )}
        <TextField
          label={t("filters.search")}
          hint={t("filters.searchHint")}
          name="search"
          type="search"
          dir="ltr"
          defaultValue={list.search ?? ""}
          maxLength={200}
          className="min-w-0 flex-1 basis-64"
        />
        <Select
          label={t("filters.show")}
          name="status"
          defaultValue={list.status ?? ""}
          className="basis-48"
        >
          <option value="">{t("filters.all")}</option>
          {NEWSLETTER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </Select>
        {/* The label's line and its gap, so the buttons sit level with the fields. */}
        <div className="mt-6 flex gap-2">
          <Button type="submit" variant="secondary">
            {t("filters.apply")}
          </Button>
          {filtered && (
            <ButtonLink href="/dashboard/newsletter" variant="quiet">
              {t("filters.clear")}
            </ButtonLink>
          )}
        </div>
      </form>

      <p role="status" className="text-sm text-ink-2">
        {t("count", { total })}
      </p>

      {subscribers.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{filtered ? t("empty.filteredTitle") : t("empty.title")}</h2>
          <p className="mt-2 text-ink-2">
            {filtered ? t("empty.filteredText") : t("empty.text")}
          </p>
        </Card>
      ) : (
        // The browser gets only this section's namespace.
        <NextIntlClientProvider
          locale={access.locale}
          messages={{ DashboardNewsletter: all.DashboardNewsletter }}
        >
          <SubscriberList subscribers={subscribers} />
        </NextIntlClientProvider>
      )}

      {pages > 1 && (
        <nav
          aria-label={t("paging.label")}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          {list.page > 1 ? (
            <ButtonLink href={link(list.page - 1)} variant="secondary" size="sm">
              {t("paging.previous")}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-sm text-ink-2">
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

      <Card as="section" aria-labelledby="newsletter-export-title">
        <h2 id="newsletter-export-title" className="text-xl">
          {t("export.title")}
        </h2>
        <p className="mt-2 text-ink-2">{t("export.text")}</p>
        {list.search && <p className="mt-1 text-ink-2">{t("export.withSearch")}</p>}
        {list.status && list.status !== "confirmed" && (
          <p className="mt-1 font-semibold text-ink">{t("export.statusIgnored")}</p>
        )}
        {/* A plain link to the API route: the browser saves the file. Not a
            locale link, so no language prefix is added. */}
        <a
          href={exportPath(list.search)}
          download
          className={buttonClasses({ variant: "secondary", className: "mt-4" })}
        >
          {t("export.button")}
        </a>
      </Card>
    </div>
  );
}
