import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CompactHeader } from "@/components/compact-header";
import { routing } from "@/i18n/routing";
import { KIT_TEXT } from "./content";
import { KitDemo } from "./kit-demo";
import { WorkspaceDemo } from "./workspace-demo";

// Dev only: local `next dev` and Vercel previews show it, production returns
// 404. Vercel sets VERCEL_ENV at build time, so the production build never
// renders this page.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function UiKitPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const { Workspace } = await getMessages();

  return (
    <>
      <CompactHeader />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-12">
        <KitDemo text={KIT_TEXT[locale]} />
        {/* The workspace components read their labels; the browser gets only that namespace. */}
        <NextIntlClientProvider locale={locale} messages={{ Workspace }}>
          <div className="mt-10">
            <WorkspaceDemo />
          </div>
        </NextIntlClientProvider>
      </main>
    </>
  );
}
