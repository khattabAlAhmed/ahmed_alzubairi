import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, ExpertiseAreaDetail, Project, Service } from "@/lib/content";
import { RichText } from "../rich-text";
import { servedOrganizations } from "./related";
import {
  CARD,
  CARD_LINK,
  CONTAINER,
  ConsultationCta,
  MoreLink,
  PageHero,
  PageSection,
  ProjectCards,
} from "../parts";

/** `/expertise`: every area published in this language (§6.4). */
export function ExpertiseListPage({ areas }: { areas: ExpertiseArea[] }) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");

  return (
    <>
      <PageHero title={tNav("expertise")} />
      <div className={cx(CONTAINER, "py-12 md:py-16")}>
        {areas.length === 0 ? (
          <p className="text-text-secondary">{t("emptyExpertise")}</p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <li key={area.id} className={cx(CARD, "border-t-4 border-t-accent")}>
                <h2 className="text-2xl">
                  <Link href={`/expertise/${area.slug}`} className={CARD_LINK}>
                    {area.title}
                  </Link>
                </h2>
                <p className="mt-3 text-pretty text-text-secondary">{area.summary}</p>
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
 * `/expertise/[slug]`: description, experience, related services, related
 * projects and the organizations served. Organizations come from the
 * projects, so a hidden name shows as its general label (§6.6).
 */
export function ExpertiseDetailPage({
  area,
  services,
  projects,
}: {
  area: ExpertiseAreaDetail;
  /** Published services in this area. */
  services: Service[];
  /** Published projects in this area. */
  projects: Project[];
}) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");
  const organizations = servedOrganizations(projects);

  return (
    <>
      <PageHero
        back={{ href: "/expertise", label: t("allExpertise") }}
        eyebrow={tNav("expertise")}
        title={area.title}
        intro={<p>{area.summary}</p>}
      />
      <div className={cx(CONTAINER, "grid gap-14 py-12 md:py-16")}>
        {area.body && (
          <PageSection id="area-experience" title={t("experience")}>
            <RichText doc={area.body} className="max-w-prose text-lg" />
          </PageSection>
        )}
        {services.length > 0 && (
          <PageSection id="area-services" title={t("areaServices")}>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <li key={service.id} className={CARD}>
                  <h3 className="text-xl">
                    <Link href={`/services/${service.slug}`} className={CARD_LINK}>
                      {service.title}
                    </Link>
                  </h3>
                  <p className="mt-3 text-pretty text-text-secondary">{service.summary}</p>
                </li>
              ))}
            </ul>
          </PageSection>
        )}
        {projects.length > 0 && (
          <PageSection id="area-projects" title={t("areaProjects")}>
            <ProjectCards projects={projects} />
          </PageSection>
        )}
        {organizations.length > 0 && (
          <PageSection id="area-organizations" title={t("areaOrganizations")}>
            <ul className="flex flex-wrap gap-3">
              {organizations.map((name) => (
                <li key={name} className="rounded-full border border-text/20 bg-surface px-4 py-2 font-semibold">
                  {name}
                </li>
              ))}
            </ul>
          </PageSection>
        )}
        <MoreLink href="/expertise" label={t("allExpertise")} />
      </div>
      <ConsultationCta />
    </>
  );
}
