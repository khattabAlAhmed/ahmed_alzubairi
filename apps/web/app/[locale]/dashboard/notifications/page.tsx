import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  loadNotifications,
  notificationsPath,
  parsePage,
} from "@/components/dashboard/notifications/data";
import { NotificationList } from "@/components/dashboard/notifications/notification-list";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * The member's own notifications (§6.21). Every team member may open it: the
 * rows are read with their own client, so RLS returns only theirs. Page 1 is
 * the latest; older ones are on the next pages, so an unread one is never out
 * of reach.
 */
export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  await requireTeamMember(params, "/dashboard/notifications");
  const { userId } = await auth();
  // requireTeamMember has already sent a signed-out visitor to sign-in.
  if (!userId) return null;

  const page = parsePage((await searchParams).page);
  const [t, locale, all, { items, unread, pages }] = await Promise.all([
    getTranslations("DashboardNotifications"),
    getLocale(),
    getMessages(),
    loadNotifications(userId, page),
  ]);
  // A page past the end (an old link): the last page.
  if (page > pages) redirect(`/${locale}${notificationsPath(pages)}`);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} />
      {items.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{t("empty.title")}</h2>
          <p className="mt-2 text-text-secondary">{t("empty.text")}</p>
        </Card>
      ) : (
        // The browser gets only this section's namespace.
        <NextIntlClientProvider
          locale={locale}
          messages={{ DashboardNotifications: all.DashboardNotifications }}
        >
          <NotificationList items={items} unread={unread} />
        </NextIntlClientProvider>
      )}

      {pages > 1 && (
        <nav
          aria-label={t("paging.label")}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          {page > 1 ? (
            <ButtonLink href={notificationsPath(page - 1)} variant="secondary" size="sm">
              {t("paging.previous")}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-sm text-text-secondary">
            {t("paging.position", { page, pages })}
          </p>
          {page < pages ? (
            <ButtonLink href={notificationsPath(page + 1)} variant="secondary" size="sm">
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
