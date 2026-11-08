import { auth } from "@clerk/nextjs/server";
import { LOCALES } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";
import { readOwnProfile } from "@/lib/auth/gates";
import { canOpenDashboard } from "@/lib/auth/profile-access";
import { grantedPermissions } from "./access";
import { DashboardNavLink } from "./dashboard-nav-link";
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

  const [t, granted] = await Promise.all([
    getTranslations("DashboardContent"),
    grantedPermissions(sectionPermissions(), locale),
  ]);
  const sections = visibleSections(granted);

  return (
    <nav aria-label={t("navLabel")}>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:flex-col md:overflow-visible md:pb-0">
        {sections.map((section) => (
          <li key={section.key}>
            <DashboardNavLink href={section.href} exact={section.key === "home"}>
              {t(`nav.${section.key}`)}
            </DashboardNavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Shown while the menu's permissions are checked. */
export function DashboardNavSkeleton() {
  return (
    <div className="flex gap-2 md:flex-col" aria-hidden="true">
      <Skeleton className="h-9 w-24 md:w-full" />
      <Skeleton className="h-9 w-24 md:w-full" />
    </div>
  );
}
