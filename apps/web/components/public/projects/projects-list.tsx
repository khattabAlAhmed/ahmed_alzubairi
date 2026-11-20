import { ORG_TYPES } from "@repo/shared";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, Project } from "@/lib/content";
import { FilterChips } from "../listing/filter-chips";
import { ProjectStoryFeatured, ProjectStoryList, ProjectStoryRow, storyFromProject } from "../project-story";
import { AREA_PARAM, filterProjects, filterQuery, ORG_TYPE_PARAM, type ProjectFilters } from "./filters";
import { CONTAINER, EmptyNote } from "../parts";

/**
 * Projects as story rows (ProjectStory board). `organization` is already the
 * general label when the name is hidden: the real name never reaches this
 * component (§6.6). The name stays for callers until Lane B moves them to
 * `ProjectStoryList`.
 */
export function ProjectCards({ projects, areas }: { projects: Project[]; areas: ExpertiseArea[] }) {
  const areaTitles = new Map(areas.map((area) => [area.id, area.title]));
  return (
    <ProjectStoryList>
      {projects.map((project) => (
        <ProjectStoryRow
          key={project.id}
          story={storyFromProject(project, { area: project.expertiseId ? areaTitles.get(project.expertiseId) : null })}
        />
      ))}
    </ProjectStoryList>
  );
}

/**
 * `/projects` below its hero: filters by expertise area and organization type
 * (§6.6), then the matching projects. Only filters that match a project show.
 * With no filter, the first featured project opens the list as a full record.
 */
export function ProjectsList({
  projects,
  areas,
  filters,
}: {
  projects: Project[];
  areas: ExpertiseArea[];
  filters: ProjectFilters;
}) {
  const t = useTranslations("Catalog");

  if (projects.length === 0) {
    return (
      <div className={cx(CONTAINER, "py-12 md:py-16")}>
        <EmptyNote text={t("noProjects")} />
      </div>
    );
  }

  const usedAreas = areas.filter((area) => projects.some((project) => project.expertiseId === area.id));
  const usedTypes = ORG_TYPES.filter((type) => projects.some((project) => project.orgType === type));
  const shown = filterProjects(projects, areas, filters);
  const filtered = filters.area !== null || filters.orgType !== null;
  const query = filterQuery(filters);
  const areaTitles = new Map(areas.map((area) => [area.id, area.title]));
  const story = (project: Project) =>
    storyFromProject(project, { area: project.expertiseId ? areaTitles.get(project.expertiseId) : null });
  const featured = filtered ? undefined : shown.find((project) => project.isFeatured);
  const rows = shown.filter((project) => project !== featured);

  return (
    <div className={cx(CONTAINER, "py-12 md:py-16")}>
      <div className="flex flex-col gap-3 border-b border-line pb-6">
        {usedAreas.length > 0 && (
          <FilterChips
            label={t("filterArea")}
            pathname="/projects"
            param={AREA_PARAM}
            query={query}
            allLabel={t("filterAll")}
            options={usedAreas.map((area) => ({ value: area.slug, label: area.title }))}
          />
        )}
        {usedTypes.length > 0 && (
          <FilterChips
            label={t("filterOrgType")}
            pathname="/projects"
            param={ORG_TYPE_PARAM}
            query={query}
            allLabel={t("filterAll")}
            options={usedTypes.map((type) => ({ value: type, label: t(`orgType.${type}`) }))}
          />
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-ink-2 type-small">
          {t("resultCount", { count: shown.length })}
        </p>
        {filtered && (
          <Link
            href="/projects"
            scroll={false}
            className="text-sm text-accent underline decoration-1 underline-offset-5 transition-state hover:decoration-2 focus-ring"
          >
            {t("clearFilters")}
          </Link>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-12">
        {shown.length === 0 && <EmptyNote text={t("noProjects")} />}
        {featured && <ProjectStoryFeatured story={story(featured)} />}
        {rows.length > 0 && (
          <ProjectStoryList>
            {rows.map((project) => (
              <ProjectStoryRow key={project.id} story={story(project)} />
            ))}
          </ProjectStoryList>
        )}
      </div>
    </div>
  );
}
