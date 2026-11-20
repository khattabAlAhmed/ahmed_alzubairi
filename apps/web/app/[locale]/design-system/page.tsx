import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CompactHeader } from "@/components/compact-header";
import { CONTAINER } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import { routing } from "@/i18n/routing";
import { ContentIdentitySection } from "./sections/content-identity";
import { ContentWorkSection } from "./sections/content-work";
import { FeedbackSection } from "./sections/feedback";
import { FormsSection } from "./sections/forms";
import { FoundationsSection } from "./sections/foundations";
import { PrimitivesSection } from "./sections/primitives";
import { ShellSection } from "./sections/shell";
import { VoiceSection } from "./sections/voice";
import { WorkspaceSection } from "./sections/workspace";

// Dev only, like the ui-kit page: local `next dev` and Vercel previews show
// it, production returns 404. Vercel sets VERCEL_ENV at build time, so the
// production build never renders it. Nothing links here, and it's noindex.

/** The groups of docs/design/components.md, in order. Each has its own file. */
const GROUPS = [
  { id: "foundations", key: "foundations", Section: FoundationsSection },
  { id: "primitives", key: "primitives", Section: PrimitivesSection },
  { id: "shell", key: "shell", Section: ShellSection },
  { id: "voice", key: "voice", Section: VoiceSection },
  { id: "content-identity", key: "contentIdentity", Section: ContentIdentitySection },
  { id: "content-work", key: "contentWork", Section: ContentWorkSection },
  { id: "forms", key: "forms", Section: FormsSection },
  { id: "feedback", key: "feedback", Section: FeedbackSection },
  { id: "workspace", key: "workspace", Section: WorkspaceSection },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const robots = { index: false, follow: false };
  if (!hasLocale(routing.locales, locale)) return { robots };
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return { title: t("metaTitle"), robots };
}

export default async function DesignSystemPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "DesignSystem" });

  return (
    <>
      <CompactHeader />
      <main id="main-content" className={cx(CONTAINER, "flex-1 py-12 md:py-16")}>
        {/* The page's one moment: the rule, then the title, then the rest. */}
        <header>
          <div aria-hidden="true" className="h-0.5 bg-rule settle" />
          <h1 className="mt-5 type-display settle settle-2">{t("title")}</h1>
          <p className="mt-3 max-w-measure text-pretty text-ink-2 settle settle-3">{t("intro")}</p>
          <nav aria-labelledby="ds-index" className="mt-8 settle settle-3">
            <h2 id="ds-index" className="sr-only">
              {t("metaTitle")}
            </h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 type-small">
              {GROUPS.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    className="text-accent underline decoration-1 underline-offset-5 transition-state hover:decoration-2"
                  >
                    {t(`${group.key}.title`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <div className="mt-section flex flex-col gap-section">
          {GROUPS.map(({ id, Section }) => (
            <Section key={id} locale={locale} />
          ))}
        </div>
      </main>
    </>
  );
}
