import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContactChannels, ContactForm } from "@/components/public/contact";
import { CONTAINER, PageHero } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getSiteSettings } from "@/lib/content";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Contact" });
  return { title: t("title") };
}

/** §6.14: direct channels and a form. No account needed, and no response-time promise. */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();
  const [t, { Contact }, settings] = await Promise.all([
    getTranslations({ locale, namespace: "Contact" }),
    getMessages({ locale }),
    getSiteSettings(),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("title")} intro={t("intro")} />
      <div className={`${CONTAINER} grid gap-12 py-12 md:py-16 lg:grid-cols-[2fr_1fr]`}>
        {/* The form is a client component: it gets only its own namespace. */}
        <NextIntlClientProvider messages={{ Contact }}>
          <ContactForm />
        </NextIntlClientProvider>
        <ContactChannels settings={settings} />
      </div>
    </main>
  );
}
