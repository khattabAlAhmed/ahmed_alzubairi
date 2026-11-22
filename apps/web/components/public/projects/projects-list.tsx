import { ORG_TYPES, type Locale } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { formatNumber } from "@/components/public/home/format";
import type { ExpertiseArea, Project } from "@/lib/content";
import { FilterChips } from "../listing/filter-chips";
import { Pagination } from "../listing/pagination";
import { MoreLink } from "../parts";
import { ProjectStoryFeatured, ProjectStoryList, ProjectStoryRow, storyFromProject } from "../project-story";
import { AREA_PARAM, filterProjects, filterQuery, ORG_TYPE_PARAM, type ProjectFilters } from "./filters";

/** Records on one page: the featured record and five rows (the Projects mockup). */
export const PROJECTS_PER_PAGE = 6;

/**
 * The projects in list order: with no filter, the first featured project
 * leads (it opens page 1 as a full record); the rest stay newest first.
 */
export function orderProjects(projects: Project[], filtered: boolean): { items: Project[]; featured: Project | null } {
  const featured = filtered ? null : (projects.find((project) => project.isFeatured) ?? null);
  return { items: featured ? [featured, ...projects.filter((project) => project !== featured)] : projects, featured };
}

/** The page of items to show, with the page number clamped to the pages there are. */
export function pageOf<T>(items: T[], page: number, size = PROJECTS_PER_PAGE): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  return { items: items.slice((current - 1) * size, current * size), page: current, totalPages };
}

/**
 * `/projects` below its header: filters by expertise area and organization
 * type (§6.6), each chip with its count, then the matching projects as
 * records (ProjectStory) and the pages. Only filters that match a project
 * show. `organization` is already the general label when the name is hidden:
 * the real name never reaches this component.
 */
export function ProjectsList({
  projects,
  areas,
  filters,
  page = 1,
}: {
  projects: Project[];
  areas: ExpertiseArea[];
  filters: ProjectFilters;
  page?: number;
}) {
  const t = useTranslations("Catalog");
  const locale = useLocale() as Locale;
  const n = (value: number) => formatNumber(value, locale);

  if (projects.length === 0) {
    return <EmptyState level={2} title={t("projectsPage.empty.title")} text={t("projectsPage.empty.text")} />;
  }

  const areaTitles = new Map(areas.map((area) => [area.id, area.title]));
  const story = (project: Project) =>
    storyFromProject(project, { area: project.expertiseId ? areaTitles.get(project.expertiseId) : null });

  // A chip's count: the projects it would show, with the other filter kept.
  const areaCount = (slug: string) => filterProjects(projects, areas, { ...filters, area: slug }).length;
  const typeCount = (orgType: (typeof ORG_TYPES)[number]) =>
    filterProjects(projects, areas, { ...filters, orgType }).length;
  const usedAreas = areas.filter((area) => projects.some((project) => project.expertiseId === area.id));
  const usedTypes = ORG_TYPES.filter((type) => projects.some((project) => project.orgType === type));

  const filtered = filters.area !== null || filters.orgType !== null;
  const query = { ...filterQuery(filters), ...(page > 1 ? { page: String(page) } : {}) };
  const shown = filterProjects(projects, areas, filters);
  const ordered = orderProjects(shown, filtered);
  const current = pageOf(ordered.items, page);
  const featured = current.page === 1 && ordered.featured ? ordered.featured : null;
  const rows = current.items.filter((project) => project !== featured);

  return (
    <div className="flex flex-col">
      <div className="mt-2 flex flex-col gap-3.5">
        {usedAreas.length > 0 && (
          <FilterChips
            label={t("filterArea")}
            pathname="/projects"
            param={AREA_PARAM}
            query={query}
            allLabel={t("filterAll")}
            options={usedAreas.map((area) => ({ value: area.slug, label: area.title, count: n(areaCount(area.slug)) }))}
          />
        )}
        {usedTypes.length > 0 && (
          <FilterChips
            label={t("filterOrgType")}
            pathname="/projects"
            param={ORG_TYPE_PARAM}
            query={query}
            allLabel={t("filterAll")}
            options={usedTypes.map((type) => ({ value: type, label: t(`orgType.${type}`), count: n(typeCount(type)) }))}
          />
        )}
        <p role="status" className="flex flex-wrap items-baseline gap-x-2 text-ink-2 type-small">
          {t("resultCount", { count: shown.length })}
          {filtered && shown.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <MoreLink href="/projects" label={t("clearFilters")} />
            </>
          )}
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-12">
        {shown.length === 0 && (
          <EmptyState
            level={2}
            outline={false}
            title={t("projectsPage.noResults.title")}
            text={t("projectsPage.noResults.text")}
            action={<MoreLink href="/projects" label={t("clearFilters")} />}
          />
        )}
        {featured && (
          <ProjectStoryFeatured story={{ ...story(featured), meta: [...story(featured).meta, featured.duration] }} />
        )}
        {rows.length > 0 && (
          <ProjectStoryList label={t("projectsPage.listLabel")}>
            {rows.map((project) => (
              <ProjectStoryRow key={project.id} story={story(project)} />
            ))}
          </ProjectStoryList>
        )}
      </div>
      <Pagination pathname="/projects" page={current.page} totalPages={current.totalPages} query={query} className="mt-6" />
    </div>
  );
}
