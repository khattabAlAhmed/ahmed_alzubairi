import type { Locale } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { HeroSection } from "@/components/public/home/hero";
import { EmptyNote } from "@/components/public/parts";
import {
  AudienceRows,
  CareerTimeline,
  CvLink,
  ExpertiseChapters,
  InlineStat,
  OrganizationRegister,
  QualificationList,
  RequestPanel,
  ServiceFacts,
  ServiceRows,
  StatBand,
  StatLedger,
  TestimonialSet,
} from "@/components/public/pages/identity";
import { RequestServiceButton } from "@/components/public/pages/request-service-button";
import { Stages } from "@/components/public/pages/services";
import { cx } from "@/components/ui/cx";
import type { HomeStat, Partner, Service, TimelineItem } from "@/lib/content";
import { DsBlock, DsNote, DsSection } from "../parts";

/*
 * components.md group 5, first half: the content components of the identity
 * pages (home, about, expertise, services, clients), each in the states its
 * board shows, with sample text from messages. Links point back to this
 * page; nothing here reads Supabase.
 */

type Props = { locale: Locale };
type T = Awaited<ReturnType<typeof getTranslations<"DesignSystemContentIdentity">>>;
type Row = Record<string, string>;

const HERE = "/design-system#content-identity";
/**
 * A design image at the 4:5 crop, standing in for the portrait: no AI face is
 * served from public/ (T02, DESIGN.md "Imagery"). The real portrait is
 * uploaded through the dashboard.
 */
const PHOTO = "/images/window-light.webp";

const rows = (t: T, key: Parameters<T["raw"]>[0]) => t.raw(key) as Row[];
const stats = (t: T, key: Parameters<T["raw"]>[0]): HomeStat[] =>
  rows(t, key).map((row, index) => ({ id: String(index), label: row.label, value: row.value }));

/** A grey placeholder mark, as the OrganizationLogos board draws one; real logos come from the dashboard. */
function logoMark(text: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect x="1" y="6" width="118" height="28" fill="none" stroke="#50555A" stroke-width="1.5"/><text x="60" y="25" font-family="sans-serif" font-size="12" letter-spacing="1" fill="#50555A" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function ContentIdentitySection({ locale }: Props) {
  const ds = await getTranslations({ locale, namespace: "DesignSystem" });
  const t = await getTranslations({ locale, namespace: "DesignSystemContentIdentity" });
  const pages = await getTranslations({ locale, namespace: "Pages" });
  const catalog = await getTranslations({ locale, namespace: "Catalog" });
  // The consultation and request buttons are client parts.
  const { Nav } = await getMessages({ locale });

  return (
    <DsSection id="content-identity" title={ds("contentIdentity.title")} intro={t("intro")}>
      <DsNote>{t("draftNote")}</DsNote>
      <NextIntlClientProvider locale={locale} messages={{ Nav }}>
        <HeroBlock t={t} />
        <StatBlock t={t} />
        <ExpertiseBlock t={t} empty={pages("emptyExpertise")} />
        <AudienceBlock t={t} />
        <ServiceListBlock t={t} empty={pages("emptyServices")} />
        <ServicePageBlock t={t} request={pages("requestService")} />
        <CareerBlock t={t} />
        <QualificationsBlock t={t} cv={pages("downloadCv")} />
        <LogosBlock t={t} />
        <TestimonialBlock t={t} empty={catalog("noClients")} />
      </NextIntlClientProvider>
    </DsSection>
  );
}

/** A sample with its state named above it. */
function State({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-3", className)}>
      <p className="text-ink-2 type-caption">{label}</p>
      {children}
    </div>
  );
}

/** What an empty list does: the section is left out, and an empty page says so in one line. */
function Empty({ t, text }: { t: T; text: string }) {
  return (
    <State label={t("states.empty")}>
      <p className="type-small max-w-measure text-ink-2">{t("empty")}</p>
      <EmptyNote text={text} />
    </State>
  );
}

/* ---------------------------------------------------------------- hero -- */

function HeroBlock({ t }: { t: T }) {
  const content = { name: t("hero.name"), title: t("hero.role"), valueStatement: t("hero.statement") };
  return (
    <DsBlock title={t("hero.title")} intro={t("hero.intro")}>
      <div className="flex flex-col gap-12">
        <State label={`${t("states.withPhoto")} · ${t("placeholderPhoto")}`}>
          <HeroSection sample="ds-hero-full" content={{ ...content, photoUrl: PHOTO }} stats={stats(t, "stats.hero")} />
        </State>
        <State label={t("states.noStats")}>
          <HeroSection sample="ds-hero-photo" content={{ ...content, photoUrl: PHOTO }} />
        </State>
        <State label={t("states.noPhoto")}>
          <HeroSection sample="ds-hero-missing" content={{ ...content, photoUrl: null }} stats={stats(t, "stats.hero")} />
        </State>
        <State label={t("states.long")}>
          <HeroSection
            sample="ds-hero-long"
            content={{ ...content, valueStatement: t("hero.longStatement"), photoUrl: PHOTO }}
            stats={stats(t, "stats.hero")}
          />
        </State>
      </div>
    </DsBlock>
  );
}

/* ---------------------------------------------------------- quiet stat -- */

function StatBlock({ t }: { t: T }) {
  return (
    <DsBlock title={t("stats.title")} intro={t("stats.intro")}>
      <div className="flex flex-col gap-10">
        <State label={t("states.band")}>
          <StatBand stats={stats(t, "stats.band")} />
        </State>
        <div className="grid gap-10 md:grid-cols-2 md:gap-gutter">
          <State label={t("states.inline")}>
            <p className="type-h3 max-w-[26em] font-medium">
              {t("stats.sentenceBefore")} <InlineStat value={t("stats.sentenceValue")} /> {t("stats.sentenceAfter")}
            </p>
          </State>
          <State label={t("states.ledger")}>
            <StatLedger stats={stats(t, "stats.ledger")} />
          </State>
        </div>
      </div>
    </DsBlock>
  );
}

/* ------------------------------------------------------ expertise area -- */

function ExpertiseBlock({ t, empty }: { t: T; empty: string }) {
  const areas = t.raw("expertise.areas") as { title: string; summary: string; covers: string[]; meta: string }[];
  return (
    <DsBlock title={t("expertise.title")} intro={t("expertise.intro")}>
      <State label={t("states.chapters")} className="mb-10">
        <ExpertiseChapters
          areas={areas.map((area, index) => ({ id: String(index), slug: "", title: area.title, summary: area.summary }))}
          covers={Object.fromEntries(areas.map((area, index) => [String(index), area.covers]))}
          meta={Object.fromEntries(areas.map((area, index) => [String(index), area.meta]))}
        />
      </State>
      <Empty t={t} text={empty} />
    </DsBlock>
  );
}

/* ------------------------------------------------------------ audience -- */

function AudienceBlock({ t }: { t: T }) {
  return (
    <DsBlock title={t("audience.title")} intro={t("audience.intro")}>
      <State label={t("states.rows")}>
        <AudienceRows items={rows(t, "audience.items").map((row) => ({ title: row.title, description: row.description }))} />
      </State>
    </DsBlock>
  );
}

/* ------------------------------------------------------------- service -- */

function ServiceListBlock({ t, empty }: { t: T; empty: string }) {
  const services: Service[] = rows(t, "services.rows").map((row, index) => ({
    id: String(index),
    slug: "",
    expertiseId: null,
    title: row.title,
    summary: row.summary,
    isFeatured: index === 0,
  }));
  return (
    <DsBlock title={t("services.title")} intro={t("services.intro")}>
      <State label={t("states.open")} className="mb-10">
        <ServiceRows
          services={services}
          openId="0"
          meta={Object.fromEntries(rows(t, "services.rows").map((row, index) => [String(index), row.meta]))}
        />
      </State>
      <Empty t={t} text={empty} />
    </DsBlock>
  );
}

function ServicePageBlock({ t, request }: { t: T; request: string }) {
  return (
    <DsBlock title={t("servicePage.title")} intro={t("servicePage.intro")}>
      <div className="grid gap-x-gutter gap-y-10 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-10 lg:col-span-9">
          <State label={t("states.facts")}>
            <ServiceFacts audience={t("servicePage.audience")} deliverables={t("servicePage.deliverables")} />
          </State>
          <State label={t("states.stages")}>
            <Stages text={t("servicePage.stages")} />
          </State>
          <State label={t("states.oneLine")}>
            <Stages text={t("servicePage.oneLine")} />
          </State>
        </div>
        <State label={t("states.panel")} className="lg:col-span-3">
          <RequestPanel
            title={t("servicePage.service")}
            action={
              <RequestServiceButton serviceSlug="sample" label={request} className="flex w-full" />
            }
          />
        </State>
      </div>
    </DsBlock>
  );
}

/* ------------------------------------------------------ career timeline -- */

function timeline(t: T, key: Parameters<T["raw"]>[0], kind: TimelineItem["kind"]): TimelineItem[] {
  return rows(t, key).map((row, index) => ({
    id: String(index),
    kind,
    title: row.title,
    description: row.description ?? null,
    period: row.period ?? null,
  }));
}

function CareerBlock({ t }: { t: T }) {
  return (
    <DsBlock title={t("career.title")} intro={t("career.intro")}>
      <State label={t("states.spine")}>
        <div className="max-w-[720px]">
          <CareerTimeline items={timeline(t, "career.items", "career")} />
        </div>
      </State>
    </DsBlock>
  );
}

/* --------------------------------------------- qualifications and values -- */

function QualificationsBlock({ t, cv }: { t: T; cv: string }) {
  return (
    <DsBlock title={t("qualifications.title")} intro={t("qualifications.intro")}>
      <State label={t("states.qualifications")}>
        <div className="flex max-w-[720px] flex-col gap-6">
          <QualificationList items={timeline(t, "qualifications.items", "qualification")} />
          <CvLink href={HERE} label={cv} detail={t("qualifications.cvDetail")} />
        </div>
      </State>
    </DsBlock>
  );
}

/* --------------------------------------------------- organization logos -- */

function LogosBlock({ t }: { t: T }) {
  const names = t.raw("logos.names") as string[];
  const partners: Partner[] = names.map((name, index) => ({
    id: String(index),
    name,
    // The last ones have no logo uploaded: the name stands alone.
    logoUrl: index < 3 ? logoMark("LOGO") : null,
  }));
  return (
    <DsBlock title={t("logos.title")} intro={t("logos.intro")}>
      <State label={t("states.register")}>
        <OrganizationRegister partners={partners} more={{ href: HERE, label: t("logos.more") }} />
      </State>
    </DsBlock>
  );
}

/* ---------------------------------------------------------- testimonial -- */

function TestimonialBlock({ t, empty }: { t: T; empty: string }) {
  const items = rows(t, "testimonial.items").map((row, index) => ({
    id: String(index),
    quote: row.quote,
    author: row.author,
    organization: row.organization,
  }));
  return (
    <DsBlock title={t("testimonial.title")} intro={t("testimonial.intro")}>
      <div className="flex flex-col gap-12">
        <State label={t("states.full")}>
          <TestimonialSet testimonials={items} source={t("testimonial.source")} />
        </State>
        <State label={t("states.single")}>
          <TestimonialSet testimonials={items.slice(0, 1)} source={t("testimonial.source")} />
        </State>
        <Empty t={t} text={empty} />
      </div>
    </DsBlock>
  );
}

