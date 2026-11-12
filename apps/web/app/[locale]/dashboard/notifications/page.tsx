import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { loadNotifications } from "@/components/dashboard/notifications/data";
import { NotificationList } from "@/components/dashboard/notifications/notification-list";
import { Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string }>;

/**
 * The member's own notifications (§6.21). Every team member may open it: the
 * rows are read with their own client, so RLS returns only theirs.
 */
export default async function NotificationsPage({ params }: { params: Params }) {
  await requireTeamMember(params, "/dashboard/notifications");
  const { userId } = await auth();
  // requireTeamMember has already sent a signed-out visitor to sign-in.
  if (!userId) return null;

  const [t, locale, all, { items, unread }] = await Promise.all([
    getTranslations("DashboardNotifications"),
    getLocale(),
    getMessages(),
    loadNotifications(userId),
  ]);

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
    </div>
  );
}
