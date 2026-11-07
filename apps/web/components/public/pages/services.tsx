import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, Faq, Project, Service, ServiceDetail } from "@/lib/content";
import {
  CARD,
  CARD_LINK,
  CONTAINER,
  ConsultationCta,
  MoreLink,
  PageHero,
  PageSection,
  ProjectCards,
  RING_ON_NAVY,
  TextBlock,
} from "./parts";
import { RequestServiceButton } from "./request-service-button";

/** `/services`: every service published in this language (§6.5). */
export function ServicesListPage({ services }: { services: Service[] }) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");

  return (
    <>
      <PageHero title={tNav("services")} />
      <div className={cx(CONTAINER, "py-12 md:py-16")}>
        {services.length === 0 ? (
          <p className="text-text-secondary">{t("emptyServices")}</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li key={service.id} className={CARD}>
                <h2 className="text-2xl">
                  <Link href={`/services/${service.slug}`} className={CARD_LINK}>
                    {service.title}
                  </Link>
                </h2>
                <p className="mt-3 text-pretty text-text-secondary">{service.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConsultationCta />
    </>
  );
}

/**
 * `/services/[slug]`: description, who it suits, what the client gets, work
 * stages, related projects, service FAQs, and "اطلب هذه الخدمة".
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
  const request = (className?: string) => (
    <RequestServiceButton serviceId={service.id} label={t("requestService")} className={className} />
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
              <p className="mt-3 text-base">
                {t("area")}:{" "}
                <Link
                  href={`/expertise/${area.slug}`}
                  className="rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {area.title}
                </Link>
              </p>
            )}
          </>
        }
        actions={request(RING_ON_NAVY)}
      />
      <div className={cx(CONTAINER, "grid gap-14 py-12 md:py-16")}>
        {(service.audience || service.deliverables) && (
          <div className="grid gap-14 md:grid-cols-2">
            {service.audience && (
              <PageSection id="service-audience" title={t("audience")}>
                <TextBlock text={service.audience} />
              </PageSection>
            )}
            {service.deliverables && (
              <PageSection id="service-deliverables" title={t("deliverables")}>
                <TextBlock text={service.deliverables} />
              </PageSection>
            )}
          </div>
        )}
        {service.stages && (
          <PageSection id="service-stages" title={t("stages")}>
            <Stages text={service.stages} />
          </PageSection>
        )}
        {projects.length > 0 && (
          <PageSection id="service-projects" title={t("serviceProjects")}>
            <ProjectCards projects={projects} />
          </PageSection>
        )}
        {faqs.length > 0 && (
          <PageSection id="service-faqs" title={t("serviceFaqs")}>
            <div className="grid max-w-3xl gap-3">
              {faqs.map((faq) => (
                <details key={faq.id} className="group rounded-lg border border-text/10 bg-surface p-5 shadow-sm">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-pretty text-text-secondary">{faq.answer}</p>
                </details>
              ))}
            </div>
          </PageSection>
        )}
        <div className="flex flex-wrap items-center gap-6">
          {request()}
          <MoreLink href="/services" label={t("allServices")} />
        </div>
      </div>
      <ConsultationCta />
    </>
  );
}

/**
 * Work stages as a numbered list when the editor wrote one stage per line,
 * otherwise as text.
 */
export function Stages({ text }: { text: string }) {
  const lines = splitStages(text);
  if (lines.length < 2) return <TextBlock text={text} />;
  return (
    <ol className="grid max-w-3xl gap-4">
      {lines.map((line, index) => (
        <li key={index} className="flex gap-4">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-heading font-bold text-on-primary"
          >
            {index + 1}
          </span>
          <span className="pt-1.5 text-pretty">{line}</span>
        </li>
      ))}
    </ol>
  );
}

/** One stage per non-blank line, without list markers the editor may have typed. */
export function splitStages(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)-]|[٠-٩]+[.)-])\s+/, "").trim())
    .filter((line) => line !== "");
}
