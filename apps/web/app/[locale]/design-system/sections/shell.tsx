import type { Locale } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { formatNumber } from "@/components/public/home/format";
import { ConsultationCta, PageHero, PageSection } from "@/components/public/parts";
import { HeaderBar } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SkeletonListItem } from "@/components/ui";
import { DsBlock, DsCode, DsNote, DsSection } from "../parts";
import { ConsentSample, LanguageAndThemeSample, MenuSample, QuickContactSample } from "./shell-client";

/*
 * components.md group 3, the site shell: one DsBlock per component, as its
 * board shows it. The wide parts (header, footer, page and section heads, the
 * invitation) follow the screen's width, so they show full width, once per
 * theme, one under the other; resize the window for the phone layout.
 */

type Props = { locale: Locale };

/** The same sample in both themes, full width, one under the other. */
async function Themed({ locale, children }: { locale: Locale; children: (theme: "light" | "dark") => ReactNode }) {
  const t = await getTranslations({ locale, namespace: "DesignSystemShell" });
  return (
    <div className="flex flex-col gap-6">
      {(["light", "dark"] as const).map((theme) => (
        <div key={theme} data-theme={theme} className="border border-line bg-bg pb-6 text-ink">
          <p className="px-4 pt-3 pb-4 text-ink-2 type-caption">{t(theme)}</p>
          {children(theme)}
        </div>
      ))}
    </div>
  );
}

/** Two themes side by side, for the narrow parts. */
async function Pair({ locale, children }: { locale: Locale; children: (theme: "light" | "dark") => ReactNode }) {
  const t = await getTranslations({ locale, namespace: "DesignSystemShell" });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["light", "dark"] as const).map((theme) => (
        <div key={theme} data-theme={theme} className="min-w-0 border border-line bg-bg p-5 text-ink">
          <p className="mb-4 text-ink-2 type-caption">{t(theme)}</p>
          {children(theme)}
        </div>
      ))}
    </div>
  );
}

export async function ShellSection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const common = await getTranslations({ locale, namespace: "Common" });
  const t = await getTranslations({ locale, namespace: "DesignSystemShell" });
  const { Header, Nav, Consent, DesignSystemShell } = await getMessages({ locale });
  const n = (value: number) => formatNumber(value, locale);

  return (
    <DsSection id="shell" title={ds("shell.title")} intro={t("intro")}>
      <NextIntlClientProvider locale={locale} messages={{ Header, Nav, Consent, DesignSystemShell }}>
        <DsBlock title={t("header.title")} intro={t("header.intro")}>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <DsCode>{t("header.signedOut")}</DsCode>
              <Themed locale={locale}>{() => <HeaderBar />}</Themed>
            </div>
            {/* A drawing of the signed-in state: the override touches no session. */}
            <div className="flex flex-col gap-3">
              <DsCode>{t("header.signedIn")}</DsCode>
              <Themed locale={locale}>{() => <HeaderBar signedInAs={t("header.sampleEmail")} />}</Themed>
            </div>
          </div>
          <DsNote className="mt-3">{t("header.note")}</DsNote>
        </DsBlock>

        <DsBlock title={t("menu.title")} intro={t("menu.intro")}>
          <Pair locale={locale}>
            {() => (
              <MenuSample />
            )}
          </Pair>
          <DsNote className="mt-3">{t("menu.note")}</DsNote>
        </DsBlock>

        <DsBlock title={t("language.title")} intro={t("language.intro")}>
          <Themed locale={locale}>
            {() => (
              <div className="px-5">
                <LanguageAndThemeSample />
              </div>
            )}
          </Themed>
          <DsNote className="mt-3">{t("language.note")}</DsNote>
        </DsBlock>

        <DsBlock title={t("quick.title")} intro={t("quick.intro")}>
          <Pair locale={locale}>
            {() => (
              <QuickContactSample />
            )}
          </Pair>
          <DsNote className="mt-3">{t("quick.note")}</DsNote>
        </DsBlock>

        <DsBlock title={t("footer.title")} intro={t("footer.intro")}>
          <Themed locale={locale}>
            {() => (
              <SiteFooter />
            )}
          </Themed>
        </DsBlock>

        <DsBlock title={t("skip.title")} intro={t("skip.intro")}>
          <Pair locale={locale}>
            {() => (
              <div className="flex flex-col items-start gap-6">
                <div className="flex flex-col items-start gap-2">
                  <DsCode>{t("skip.skipLabel")}</DsCode>
                  {/* The skip link's focused look, drawn still (skip-link.tsx). */}
                  <span className="bg-ink px-4.5 py-3 text-[15px] text-bg outline-2 outline-offset-3 outline-focus outline-solid">
                    {common("skipToContent")}
                  </span>
                </div>
                <div className="flex w-full flex-col items-start gap-2">
                  <DsCode>{t("skip.consentLabel")}</DsCode>
                  <div className="w-full">
                    <ConsentSample />
                  </div>
                </div>
              </div>
            )}
          </Pair>
          <DsNote className="mt-3">{t("skip.note")}</DsNote>
        </DsBlock>

        <DsBlock title={t("pageHeader.title")} intro={t("pageHeader.intro")}>
          <Themed locale={locale}>
            {() => (
              <PageHero
                eyebrow={t("pageHeader.sampleEyebrow")}
                title={t("pageHeader.sampleTitle")}
                intro={t("pageHeader.sampleIntro")}
                facts={[
                  { label: t("pageHeader.factProjects"), value: n(38) },
                  { label: t("pageHeader.factOrganizations"), value: n(21) },
                  { label: t("pageHeader.factUpdated"), value: t("pageHeader.sampleUpdated") },
                ]}
              />
            )}
          </Themed>
          <DsNote className="mt-6">{t("pageHeader.photoNote")}</DsNote>
          <Themed locale={locale}>
            {() => (
              <PageHero
                eyebrow={t("pageHeader.photoEyebrow")}
                title={t("pageHeader.photoTitle")}
                intro={t("pageHeader.photoIntro")}
                photo={{ src: "/images/window-light.webp", alt: t("pageHeader.photoAlt") }}
              />
            )}
          </Themed>
        </DsBlock>

        <DsBlock title={t("section.title")} intro={t("section.intro")}>
          <Themed locale={locale}>
            {(theme) => (
              <div className="mx-auto w-full max-w-[calc(var(--container)+2*var(--page-margin))] px-page-margin">
                <PageSection
                  id={`ds-section-sample-${theme}`}
                  title={t("section.sampleTitle")}
                  intro={t("section.sampleIntro")}
                  more={{ href: "/projects", label: t("section.sampleMore"), count: n(38) }}
                >
                  <div aria-hidden="true" className="grid gap-gutter md:grid-cols-3">
                    <SkeletonListItem />
                    <SkeletonListItem />
                    <SkeletonListItem />
                  </div>
                </PageSection>
              </div>
            )}
          </Themed>
          <DsNote className="mt-3">{t("section.note")}</DsNote>
        </DsBlock>

        <DsBlock title={t("breadcrumb.title")} intro={t("breadcrumb.intro")}>
          <Pair locale={locale}>
            {() => (
              <Breadcrumb
                items={[{ label: t("breadcrumb.sampleSection"), href: "/services" }, { label: t("breadcrumb.samplePage") }]}
              />
            )}
          </Pair>
          <DsNote className="mt-3">{t("breadcrumb.note")}</DsNote>
        </DsBlock>

        <DsBlock title={t("cta.title")} intro={t("cta.intro")}>
          <DsNote>{t("cta.fullNote")}</DsNote>
          <Themed locale={locale}>{() => <ConsultationCta />}</Themed>
          <DsNote className="mt-6">{t("cta.textNote")}</DsNote>
          <Themed locale={locale}>{() => <ConsultationCta variant="text" />}</Themed>
          <DsNote className="mt-6">{t("cta.photoNote")}</DsNote>
          <Themed locale={locale}>{() => <ConsultationCta variant="photo" />}</Themed>
          <DsNote className="mt-6">{t("cta.noneNote")}</DsNote>
        </DsBlock>
      </NextIntlClientProvider>
    </DsSection>
  );
}
