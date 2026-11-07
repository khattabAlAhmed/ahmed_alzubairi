import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ACCOUNT_NAV } from "@/components/nav-items";

export default function AccountLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Account");

  return (
    <AppShell
      title={t("title")}
      navLabel={t("navLabel")}
      links={ACCOUNT_NAV.map(({ href, label }) => ({ href, label: t(label) }))}
    >
      {children}
    </AppShell>
  );
}
