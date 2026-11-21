import type { Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/components/public/home/format";
import { cx, INLINE_LINK } from "@/components/ui/cx";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, Faq, Project, Service, ServiceDetail } from "@/lib/content";
import { CONTAINER, ConsultationCta, EmptyNote, MoreLink, PageHero, PageSection } from "../parts";
import { ProjectStoryList, ProjectStoryRow, storyFromProject } from "../project-story";
import { RequestPanel, ServiceFacts, ServiceRows, splitLines, StageStrip } from "./identity";
import { RequestServiceButton, SignedOutNote } from "./request-service-button";

/** `/services`: every service published in this language (§6.5), as an index; the first featured one is open. */
export function ServicesListPage({ services }: { services: Service[] }) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");
  const featured = services.find((service) => service.isFeatured) ?? null;

  return (
    <>
      <PageHero title={tNav("services")} />
      <div className={cx(CONTAINER, "mt-section")}>
        {services.length === 0 ? (
          <EmptyNote text={t("emptyServices")} />
        ) : (
          <ServiceRows services={services} openId={featured?.id} headingLevel={2} />
        )}
      </div>
      <ConsultationCta />
    </>
  );
}

/**
 * `/services/[slug]` (the ServicePage board): who it suits and what the client
 * gets, the work stages, related projects and FAQs, with «اطلب هذه الخدمة»
 * in a panel beside them.
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
  const request = (className?: string) => (
    <RequestServiceButton serviceSlug={service.slug} label={t("requestService")} className={className} />
  );

  return (
    <>
      <PageHero
        back={{ href: "/services", label: t("allServices") }}
        eyebrow={tNav("services")}
        title={service.title}
        intro={
          <>
            <p>{service.summary}</p>
            {area && (
              <p className="type-small mt-3">
                {t("area")}:{" "}
                <Link href={`/expertise/${area.slug}`} className={INLINE_LINK}>
                  {area.title}
                </Link>
              </p>
            )}
          </>
        }
        actions={request()}
      />
      <div className={cx(CONTAINER, "mt-section grid gap-x-gutter gap-y-section lg:grid-cols-12")}>
        <div className="flex min-w-0 flex-col gap-section lg:col-span-9">
          {(service.audience || service.deliverables) && (
            <ServiceFacts audience={service.audience} deliverables={service.deliverables} />
          )}
          {service.stages && (
            <section aria-labelledby="service-stages">
              <h2 id="service-stages" className="type-small mb-2 text-ink-2">
                {t("stages")}
              </h2>
              <Stages text={service.stages} />
            </section>
          )}
          {projects.length > 0 && (
            <PageSection id="service-projects" title={t("serviceProjects")}>
              <ProjectStoryList>
                {projects.map((project) => (
                  <ProjectStoryRow key={project.id} story={storyFromProject(project)} headingLevel={3} />
                ))}
              </ProjectStoryList>
            </PageSection>
          )}
          {faqs.length > 0 && (
            <PageSection id="service-faqs" title={t("serviceFaqs")}>
              <div className="max-w-measure border-t border-line">
                {faqs.map((faq) => (
                  <details key={faq.id} className="group border-b border-line">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 font-medium focus-ring [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <ChevronDownIcon
                        aria-hidden="true"
                        className="mt-1 size-4 shrink-0 text-ink-2 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      />
                    </summary>
                    <p className="type-small pb-4 whitespace-pre-line text-pretty text-ink-2">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </PageSection>
          )}
          <MoreLink href="/services" label={t("allServices")} back />
        </div>
        <aside className="lg:col-span-3">
          <RequestPanel
            title={service.title}
            action={request("flex w-full")}
            after={<SignedOutNote>{tIdentity("accountNote")}</SignedOutNote>}
          >
            <p className="type-small text-pretty text-ink-2">{tIdentity("panelNote")}</p>
          </RequestPanel>
        </aside>
      </div>
      <ConsultationCta />
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
