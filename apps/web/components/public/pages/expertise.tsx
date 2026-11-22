import { useLocale, useTranslations } from "next-intl";
import { ArrowForwardIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { formatNumber } from "@/components/public/home/format";
import { AREA_PARAM } from "@/components/public/projects/filters";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, ExpertiseAreaDetail, Project, Service } from "@/lib/content";
import { RichText } from "../rich-text";
import { CONTAINER, ConsultationCta, MoreLink, PageHero, PageSection } from "../parts";
import { ProjectStoryList, ProjectStoryRow, storyFromProject } from "../project-story";
import { ExpertiseChapters, OrganizationRegister } from "./identity";
import { areaFacts, servedOrganizations } from "./related";

/**
 * `/expertise`: every area published in this language (§6.4), as chapters:
 * each with the services it covers and its real counts. One sentence of his
 * opens the page.
 */
export function ExpertiseListPage({
  areas,
  services,
  projects,
}: {
  areas: ExpertiseArea[];
  /** Published services, to list what each area covers. */
  services: Service[];
  /** Published projects, for each area's counts. */
  projects: Project[];
}) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");
  const locale = useLocale() === "ar" ? "ar" : "en";

  const covers = Object.fromEntries(
    areas.map((area) => [area.id, services.filter((service) => service.expertiseId === area.id).map((service) => service.title)]),
  );
  const meta = Object.fromEntries(
    areas.map((area) => {
      const facts = areaFacts(projects.filter((project) => project.expertiseId === area.id));
      if (facts.projects === 0) return [area.id, ""];
      return [
        area.id,
        [
          `${t("factProjects")} ${formatNumber(facts.projects, locale)}`,
          facts.organizations > 0 && `${t("factOrganizations")} ${formatNumber(facts.organizations, locale)}`,
        ]
          .filter(Boolean)
          .join(" · "),
      ];
    }),
  );

  return (
    <>
      <PageHero eyebrow={tNav("expertise")} title={t("expertiseSentence")} />
      <div className={cx(CONTAINER, "mt-section")}>
        {areas.length === 0 ? (
          <EmptyState
            level={2}
            title={t("emptyExpertiseTitle")}
            text={t("emptyExpertise")}
            action={<MoreLink href="/contact" label={tNav("contact")} />}
          />
        ) : (
          <ExpertiseChapters areas={areas} headingLevel={2} covers={covers} meta={meta} />
        )}
      </div>
      <ConsultationCta />
    </>
  );
}

/** How many projects an area page shows before "all projects in this area". */
export const AREA_PROJECTS_SHOWN = 3;

/**
 * `/expertise/[slug]` (the Expertise mockup): the page header with the area's
 * counts as a ledger; what he means by the area, with its services beside it;
 * its latest projects as stories; and the organizations served. Organizations
 * come from the projects, so a hidden name is already its general label
 * (§6.6). Sections with nothing to show aren't rendered.
 */
export function ExpertiseDetailPage({
  area,
  services,
  projects,
}: {
  area: ExpertiseAreaDetail;
  /** Published services in this area. */
  services: Service[];
  /** Published projects in this area, newest first. */
  projects: Project[];
}) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const n = (value: number) => formatNumber(value, locale);

  const organizations = servedOrganizations(projects);
  // Newest first, as `getProjects` gives them.
  const shown = projects.slice(0, AREA_PROJECTS_SHOWN);
  const facts = [
    projects.length > 0 && { label: t("factProjects"), value: n(projects.length) },
    organizations.length > 0 && { label: t("factOrganizations"), value: n(organizations.length) },
  ].filter((fact) => fact !== false);
  const projectsHref = `/projects?${AREA_PARAM}=${encodeURIComponent(area.slug)}`;

  return (
    <>
      <PageHero
        back={{ href: "/expertise", label: tNav("expertise") }}
        title={area.title}
        intro={<p>{area.summary}</p>}
        facts={facts}
      />
      <div className={cx(CONTAINER, "mt-section grid gap-section")}>
        {(area.body || services.length > 0) && (
          <section aria-labelledby="area-meaning" className="grid gap-x-gutter gap-y-6 md:grid-cols-12">
            <h2 id="area-meaning" className="type-small text-ink-2 md:col-span-3">
              {t("areaMeaning", { area: area.title })}
            </h2>
            {area.body && <RichText doc={area.body} className="max-w-measure md:col-span-9 lg:col-span-6" />}
            {services.length > 0 && (
              <nav
                aria-labelledby="area-services"
                className="border-t-2 border-rule md:col-span-9 md:col-start-4 lg:col-span-3 lg:col-start-10"
              >
                <p id="area-services" className="type-caption py-2.5 text-ink-2">
                  {t("areaServices")}
                </p>
                <ul>
                  {services.map((service) => (
                    <li key={service.id} className="border-t border-line last:border-b">
                      <Link
                        href={`/services/${service.slug}`}
                        className="group flex items-center justify-between gap-3 py-3 text-ink no-underline transition-state hover:text-accent focus-ring"
                      >
                        <span className="type-small decoration-1 underline-offset-4 group-hover:underline">{service.title}</span>
                        <ArrowForwardIcon aria-hidden="true" className="size-4 shrink-0 text-ink-2" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </section>
        )}
        {shown.length > 0 && (
          <PageSection
            id="area-projects"
            title={t("areaProjects")}
            intro={
              projects.length > shown.length
                ? t("areaProjectsCount", { count: projects.length, shown: n(projects.length) })
                : undefined
            }
            more={{ href: projectsHref, label: t("areaAllProjects") }}
          >
            <ProjectStoryList>
              {shown.map((project) => (
                <ProjectStoryRow key={project.id} story={storyFromProject(project)} headingLevel={3} />
              ))}
            </ProjectStoryList>
          </PageSection>
        )}
        {organizations.length > 0 && (
          <PageSection id="area-organizations" title={t("areaOrganizations")}>
            <OrganizationRegister
              partners={organizations.map((name) => ({ id: name, name, logoUrl: null }))}
              more={{ href: "/clients", label: t("allOrganizations") }}
            />
          </PageSection>
        )}
      </div>
      <ConsultationCta />
    </>
  );
}
