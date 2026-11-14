import { auth } from "@clerk/nextjs/server";
import { LOCALES } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";
import { readOwnProfile } from "@/lib/auth/gates";
import { canOpenDashboard } from "@/lib/auth/profile-access";
import { grantedPermissions } from "./access";
import { DashboardNavLink } from "./dashboard-nav-link";
import { DashboardNavMenu } from "./dashboard-nav-menu";
import { loadUnreadCount } from "./notifications/data";
import { RefreshOnNavigation } from "./notifications/refresh-on-navigation";
import { BADGE_MAX, UnreadBadge } from "./notifications/unread-badge";
import { sectionPermissions, visibleSections } from "./sections";

/**
 * The dashboard menu, built on the server from the member's permissions:
 * a section they can't open is never sent to the browser. Pages still check
 * their own permission; this only decides what is listed.
 */
export async function DashboardNav({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = LOCALES.find((item) => item === raw);
  const { userId } = await auth();
  // The page itself redirects anyone who isn't a team member.
  if (!locale || !userId || !canOpenDashboard(await readOwnProfile(userId))) {
    return null;
  }

  const [t, tn, granted, unread] = await Promise.all([
    getTranslations("DashboardContent"),
    getTranslations("DashboardNotifications"),
    grantedPermissions(sectionPermissions(), locale),
    // The member's own rows, through RLS. Read on every render of the menu.
    loadUnreadCount(userId),
  ]);
  const sections = visibleSections(granted);
  // Nothing at zero. Digits follow the UI language, like the other counts.
  const badge = (
    <UnreadBadge
      count={unread}
      text={
        unread > BADGE_MAX
          ? tn("badge.more", { max: BADGE_MAX })
          : tn("badge.count", { count: unread })
      }
      label={tn("badge.unread", { count: unread })}
    />
  );

  return (
    <DashboardNavMenu label={t("navLabel")} badge={badge}>
      {sections.map((section) => (
        <li key={section.key}>
          <DashboardNavLink href={section.href} exact={section.key === "home"}>
            {t(`nav.${section.key}`)}
          </DashboardNavLink>
        </li>
      ))}
      {/* Every team member has notifications, so no permission decides it. */}
      <li>
        <DashboardNavLink href="/dashboard/notifications">
          <span className="flex items-center justify-between gap-2">
            <span data-nav-label="">{tn("nav")}</span>
            {badge}
          </span>
        </DashboardNavLink>
        <RefreshOnNavigation />
      </li>
    </DashboardNavMenu>
  );
}

/** Shown while the menu's permissions are checked. */
export function DashboardNavSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {/* A phone shows the menu button; md and up show the column. */}
      <Skeleton className="h-11 w-full md:hidden" />
      <Skeleton className="hidden h-9 w-full md:block" />
      <Skeleton className="hidden h-9 w-full md:block" />
    </div>
  );
}
