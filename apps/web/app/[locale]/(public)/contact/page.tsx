import type { Metadata } from "next";
import Image from "next/image";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContactChannels, ContactForm } from "@/components/public/contact";
import { CONTAINER, PageHero } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { cx, INLINE_LINK } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CONSULTATION_HREF } from "@/components/nav-items";
import { RETURN_PARAM } from "@/lib/auth/return-path";
import { getSiteSettings } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "contact");
}

/**
 * §6.14, the ContactForm board: the page header in his voice, the form on the
 * start side, and the direct channels beside it. No account needed, and no
 * response-time promise.
 */
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
      <PageHero
        eyebrow={t("title")}
        title={t("heading")}
        intro={
          <p>
            {t.rich("lead", {
              // After signing in, straight to the consultations, as the sentence says.
              signIn: (chunks) => (
                <Link
                  href={{ pathname: "/sign-in", query: { [RETURN_PARAM]: `/${locale}${CONSULTATION_HREF}` } }}
                  className={INLINE_LINK}
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        }
      />
      <div className={cx(CONTAINER, "grid gap-12 pb-section lg:grid-cols-12 lg:gap-gutter")}>
        <div className="min-w-0 lg:col-span-7">
          {/* The form is a client component: it gets only its own namespace. */}
          <NextIntlClientProvider messages={{ Contact }}>
            <ContactForm />
          </NextIntlClientProvider>
        </div>
        <aside className="flex min-w-0 flex-col gap-6 lg:col-span-4 lg:col-start-9">
          <ContactChannels settings={settings} />
          {/* A quiet design photo (3:2), the same one the NotFound board uses. */}
          <div className="relative aspect-[3/2] bg-surface">
            <Image
              src="/images/the-table.webp"
              alt={t("photoAlt")}
              fill
              sizes="(min-width: 1024px) 25vw, 100vw"
              className="object-cover"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
