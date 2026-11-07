import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Dashboard");

  return (
    <AppShell title={t("title")} navLabel={t("navLabel")} links={[]}>
      {children}
    </AppShell>
  );
}
