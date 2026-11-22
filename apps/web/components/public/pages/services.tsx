import type { Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FaqItem } from "@/app/[locale]/(public)/faq/faq-list";
import { EmptyState } from "@/components/empty-state";
import { formatNumber } from "@/components/public/home/format";
import { cx, INLINE_LINK } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, Faq, Project, Service, ServiceDetail } from "@/lib/content";
import { CONTAINER, ConsultationCta, MoreLink, PageHero, PageSection, type LedgerFact } from "../parts";
import { ProjectStoryList, ProjectStoryRow, storyFromProject } from "../project-story";
import { RequestPanel, ServiceFacts, ServiceRows, splitLines, StageStrip } from "./identity";
import { RequestServiceButton, SignedOutNote } from "./request-service-button";

/** The steps every service starts with, in order (approved voice copy, the Services mockup). */
const HOW_STEPS = ["write", "ask", "agree", "listen"] as const;

/**
 * `/services` (the Services mockup): one sentence of his and how many services
 * there are, the index of services with the first featured one open and each
 * row's number of stages, then how the work starts, the same for every
 * service.
 */
export function ServicesListPage({
  services,
  stageCounts = {},
}: {
  services: Service[];
  /** How many stages each service has, by id, when its editor wrote one per line. */
  stageCounts?: Readonly<Record<string, number>>;
}) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");
  const locale = useLocale() as Locale;
  const n = (value: number) => formatNumber(value, locale);
  const featured = services.find((service) => service.isFeatured) ?? null;
  const meta = Object.fromEntries(
    Object.entries(stageCounts).map(([id, count]) => [id, t("stagesCount", { count, shown: n(count) })]),
  );

  return (
    <>
      <PageHero
        eyebrow={services.length > 0 ? t("servicesEyebrow", { count: n(services.length) }) : tNav("services")}
        title={t("servicesSentence")}
        intro={<p>{t("servicesIntro")}</p>}
      />
      <div className={cx(CONTAINER, "grid gap-section")}>
        {services.length === 0 ? (
          <EmptyState
            level={2}
            title={t("emptyServicesTitle")}
            text={t("emptyServices")}
            action={<MoreLink href="/contact" label={tNav("contact")} />}
          />
        ) : (
          <nav aria-label={tNav("services")}>
            <ServiceRows services={services} openId={featured?.id} headingLevel={2} meta={meta} />
          </nav>
        )}
        <PageSection id="services-how" title={t("howTitle")} intro={t("howIntro")}>
          <StageStrip
            text={HOW_STEPS.map((step) => `${t(`how.${step}.title`)}: ${t(`how.${step}.text`)}`).join("\n")}
            formatIndex={n}
          />
        </PageSection>
      </div>
      <ConsultationCta />
    </>
  );
}

/** A part of the service page under a quiet label (the Service mockup), not a section head. */
function Part({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="type-small mb-2 text-ink-2">
        {label}
      </h2>
      {children}
    </section>
  );
}

/**
 * `/services/[slug]` (the Service mockup): the page header with the service's
 * facts as a ledger; who it suits and what the client receives; the work
 * stages; projects from this service as stories; its questions; and
 * «اطلب هذه الخدمة» in the panel beside them, which follows the questions on
 * phones. Parts with nothing to show aren't rendered.
 */
export function ServiceDetailPage({
  service,
  area,
  projects,
  faqs,
}: {
  service: ServiceDetail;
  /** The service's expertise area, when it's published in this language. */
  area: ExpertiseArea | null;
  /** Projects linked to this service. */
  projects: Project[];
  /** FAQs attached to this service. */
  faqs: Faq[];
}) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");
  const tIdentity = useTranslations("ContentIdentity.service");
  const locale = useLocale() as Locale;
  const n = (value: number) => formatNumber(value, locale);

  const stageCount = service.stages ? splitLines(service.stages).length : 0;
  const facts: LedgerFact[] = [
    ...(stageCount > 1 ? [{ label: t("factStages"), value: n(stageCount) }] : []),
    ...(projects.length > 0 ? [{ label: t("factPastProjects"), value: n(projects.length) }] : []),
    // The area links to its page, as everywhere else on the site.
    ...(area
      ? [
          {
            label: t("area"),
            value: (
              <Link href={`/expertise/${area.slug}`} className={INLINE_LINK}>
                {area.title}
              </Link>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHero
        back={{ href: "/services", label: tNav("services") }}
        title={service.title}
        intro={<p>{service.summary}</p>}
        facts={facts}
      />
      <div className={cx(CONTAINER, "mt-4 md:mt-12 grid gap-x-gutter gap-y-section lg:grid-cols-12")}>
        <div className="flex min-w-0 flex-col gap-14 lg:col-span-9">
          {(service.audience || service.deliverables) && (
            <ServiceFacts audience={service.audience} deliverables={service.deliverables} />
          )}
          {service.stages && (
            <Part id="service-stages" label={t("stages")}>
              <Stages text={service.stages} />
            </Part>
          )}
          {projects.length > 0 && (
            <Part id="service-projects" label={t("serviceProjects")}>
              <ProjectStoryList>
                {projects.map((project) => (
                  <ProjectStoryRow
                    key={project.id}
                    story={storyFromProject(project, { area: area?.title })}
                    headingLevel={3}
                  />
                ))}
              </ProjectStoryList>
            </Part>
          )}
          {faqs.length > 0 && (
            <Part id="service-faqs" label={t("serviceFaqs")}>
              <div className="border-t-2 border-rule">
                {faqs.map((faq, index) => (
                  <FaqItem key={faq.id} question={faq.question} answer={faq.answer} open={index === 0} />
                ))}
              </div>
            </Part>
          )}
        </div>
        <aside className="lg:col-span-3">
          <RequestPanel
            title={service.title}
            action={<RequestServiceButton serviceSlug={service.slug} label={t("requestService")} className="flex w-full" />}
            after={<SignedOutNote>{tIdentity("accountNote")}</SignedOutNote>}
          >
            <p className="type-small text-pretty text-ink-2">{tIdentity("panelNote")}</p>
          </RequestPanel>
        </aside>
      </div>
    </>
  );
}

/**
 * Work stages as numbered columns (the ServicePage board) when the editor
 * wrote one stage per line, otherwise as text. Numbers in the page's digits.
 */
export function Stages({ text }: { text: string }) {
  const locale = useLocale() as Locale;
  return <StageStrip text={text} formatIndex={(n) => formatNumber(n, locale)} />;
}

/** One stage per non-blank line, without list markers the editor may have typed. */
export function splitStages(text: string): string[] {
  return splitLines(text);
}
