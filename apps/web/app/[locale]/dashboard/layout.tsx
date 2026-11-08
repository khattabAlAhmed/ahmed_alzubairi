import { useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import {
  DashboardNav,
  DashboardNavSkeleton,
} from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const t = useTranslations("Dashboard");

  return (
    <AppShell
      title={t("title")}
      navLabel={t("navLabel")}
      links={[]}
      menu={
        // The menu reads the session, so it streams in after the shell.
        <Suspense fallback={<DashboardNavSkeleton />}>
          <DashboardNav params={params} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
