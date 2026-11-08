import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * The messages dashboard client components use, and nothing else, so the
 * browser gets only the dashboard namespaces.
 */
export async function DashboardIntl({ children }: { children: ReactNode }) {
  const [locale, { DashboardContent, DashboardEditor }] = await Promise.all([
    getLocale(),
    getMessages(),
  ]);

  return (
    <NextIntlClientProvider locale={locale} messages={{ DashboardContent, DashboardEditor }}>
      {children}
    </NextIntlClientProvider>
  );
}
