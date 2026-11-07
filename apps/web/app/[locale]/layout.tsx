import { ClerkProvider } from "@clerk/nextjs";
import { SITE_NAME } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { localeDirection, routing } from "@/i18n/routing";
import { clerkAppearance } from "@/lib/auth/appearance";
import { clerkLocalization } from "@/lib/auth/localization";
import { signInPath, signUpPath } from "@/lib/auth/return-path";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: SITE_NAME,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Only what client components use, to keep the browser bundle small.
  const { Header, Nav, Error: ErrorMessages, Clerk } = await getMessages();

  // next-themes sets the class on <html> before hydration, so React must
  // accept the difference from the server's markup.
  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-text">
        <NextIntlClientProvider
          locale={locale}
          messages={{ Header, Nav, Error: ErrorMessages }}
        >
          <ClerkProvider
            localization={clerkLocalization(locale, Clerk)}
            appearance={clerkAppearance}
            signInUrl={signInPath(locale)}
            signUpUrl={signUpPath(locale)}
            afterSignOutUrl={`/${locale}`}
          >
            <ThemeProvider>{children}</ThemeProvider>
          </ClerkProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
