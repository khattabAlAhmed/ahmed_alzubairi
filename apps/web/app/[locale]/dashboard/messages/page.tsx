import { DEFAULT_PAGE_SIZE, PERMISSIONS } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { sectionAccess } from "@/components/dashboard/gate";
import {
  loadMessages,
  messagesPath,
  parseMessageParams,
} from "@/components/dashboard/messages/data";
import { MessageList } from "@/components/dashboard/messages/message-list";
import { Refusal } from "@/components/dashboard/refusal";
import {
  Button,
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
 * Contact form messages (§6.20). Open with `messages.view`, checked here on
 * the server; the rows are read with the member's own client, so RLS checks
 * it again, and the PATCH route checks it for every change.
 */
export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  await requireTeamMember(params, "/dashboard/messages");
  const access = await sectionAccess(params, PERMISSIONS.MESSAGES_VIEW);
  if (!access.allowed) return <Refusal />;

  const list = parseMessageParams(await searchParams);
  const [t, all, { messages, total }] = await Promise.all([
    getTranslations("DashboardMessages"),
    getMessages(),
    loadMessages(list),
  ]);
  const filtered = Boolean(list.search || list.read);
  const pages = Math.max(1, Math.ceil(total / list.pageSize));
  const link = (page: number) =>
    messagesPath({
      page,
      pageSize: list.pageSize,
      search: list.search,
      read: list.read,
    });
  // A page past the end (an old link, or fewer matches now): the last page.
  if (list.page > pages) redirect(`/${access.locale}${link(pages)}`);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} />

      {/* A plain GET form: the filter lives in the address and works without scripts. */}
      <form
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
          label={t("filters.show")}
          name="read"
          defaultValue={list.read ?? ""}
          className="basis-48"
        >
          <option value="">{t("filters.all")}</option>
          <option value="unread">{t("filters.unread")}</option>
          <option value="read">{t("filters.read")}</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            {t("filters.apply")}
          </Button>
          {filtered && (
            <ButtonLink href="/dashboard/messages" variant="quiet">
              {t("filters.clear")}
            </ButtonLink>
          )}
        </div>
      </form>

      <p role="status" className="text-sm text-text-secondary">
        {t("count", { total })}
      </p>

      {messages.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">
            {filtered ? t("empty.filteredTitle") : t("empty.title")}
          </h2>
          <p className="mt-2 text-text-secondary">
            {filtered ? t("empty.filteredText") : t("empty.text")}
          </p>
        </Card>
      ) : (
        // The browser gets only this section's namespace.
        <NextIntlClientProvider
          locale={access.locale}
          messages={{ DashboardMessages: all.DashboardMessages }}
        >
          <MessageList messages={messages} />
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
