import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import type { ExpertiseArea, ExpertiseAreaDetail, Project, Service } from "@/lib/content";
import { RichText } from "../rich-text";
import { CONTAINER, ConsultationCta, EmptyNote, MoreLink, PageHero, PageSection } from "../parts";
import { ProjectStoryList, ProjectStoryRow, storyFromProject } from "../project-story";
import { ExpertiseChapters, ServiceRows } from "./identity";
import { servedOrganizations } from "./related";

/** `/expertise`: every area published in this language (§6.4). */
export function ExpertiseListPage({ areas }: { areas: ExpertiseArea[] }) {
  const t = useTranslations("Pages");
  const tNav = useTranslations("Nav");

  return (
    <>
      <PageHero title={tNav("expertise")} />
      <div className={cx(CONTAINER, "mt-section")}>
        {areas.length === 0 ? <EmptyNote text={t("emptyExpertise")} /> : <ExpertiseChapters areas={areas} headingLevel={2} />}
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
      <div className={cx(CONTAINER, "mt-section grid gap-section")}>
        {area.body && (
          <PageSection id="area-experience" title={t("experience")}>
            <RichText doc={area.body} className="max-w-measure" />
          </PageSection>
        )}
        {services.length > 0 && (
          <PageSection id="area-services" title={t("areaServices")}>
            <ServiceRows services={services} />
          </PageSection>
        )}
        {projects.length > 0 && (
          <PageSection id="area-projects" title={t("areaProjects")}>
            <ProjectStoryList>
              {projects.map((project) => (
                <ProjectStoryRow key={project.id} story={storyFromProject(project, { area: area.title })} headingLevel={3} />
              ))}
            </ProjectStoryList>
          </PageSection>
        )}
        {organizations.length > 0 && (
          <PageSection id="area-organizations" title={t("areaOrganizations")}>
            {/* Already the general label when a name is hidden (§6.6). */}
            <ul className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-3 sm:gap-x-gutter">
              {organizations.map((name) => (
                <li key={name} className="type-small border-b border-line py-3 text-pretty">
                  {name}
                </li>
              ))}
            </ul>
          </PageSection>
        )}
        <MoreLink href="/expertise" label={t("allExpertise")} back />
      </div>
      <ConsultationCta />
    </>
  );
}
