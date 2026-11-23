import { SITE_NAME } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Analytics } from "@/components/analytics/analytics";
import { ConsentChoice } from "@/components/analytics/consent-choice";
import { ConsentSpacer } from "@/components/consent-banner";
import { SkipLink } from "@/components/skip-link";
import { ThemeProvider } from "@/components/theme-provider";
import { localeDirection, routing } from "@/i18n/routing";
import { OG_LOCALES, siteUrl, TITLE_TEMPLATE } from "@/lib/seo";
import { fontVariables } from "../fonts";
import "../globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Seo" });
  // Defaults for every page; each page adds its canonical and hreflang (lib/seo).
  return {
    metadataBase: siteUrl(),
    title: { default: SITE_NAME, template: TITLE_TEMPLATE },
    description: t("description"),
    openGraph: { siteName: SITE_NAME, locale: OG_LOCALES[locale], type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

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
  const { Header, Nav, Error: ErrorMessages, Consent } = await getMessages();

  // next-themes sets the class on <html> before hydration, so React must
  // accept the difference from the server's markup.
  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <NextIntlClientProvider
          locale={locale}
          messages={{ Header, Nav, Error: ErrorMessages, Consent }}
        >
          {/*
            Clerk isn't loaded here (§13 Performance): account, dashboard and
            the auth pages mount it in their layouts (AppClerkProvider), and
            public pages load it after idle (LazyClerk).
          */}
          {/*
            Keyboard order: the skip link, then the cookie banner (fixed at the
            bottom of the screen, but early in the page so it's reached first),
            then the page. The banner's spacer stays last, so the page still
            ends with room for it.
          */}
          <SkipLink />
          <ConsentChoice />
          <ThemeProvider>{children}</ThemeProvider>
          <ConsentSpacer />
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
