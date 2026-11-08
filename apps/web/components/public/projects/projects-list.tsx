import { ORG_TYPES } from "@repo/shared";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, Project } from "@/lib/content";
import { filterProjects, filterQuery, type ProjectFilters } from "./filters";
import { CARD, CARD_LINK, CONTAINER, EmptyNote } from "../parts";

const CHIP =
  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const CHIP_OFF = "border-text/20 text-text hover:bg-text/10";
const CHIP_ON = "border-text bg-text text-background";

type Option = { key: string; label: string; filters: ProjectFilters; active: boolean };

/** One row of filter links. Each is a plain link, so filters work without JavaScript. */
function FilterGroup({ id, label, options }: { id: string; label: string; options: Option[] }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2 md:flex-row md:items-baseline md:gap-4">
      <p id={id} className="shrink-0 text-sm font-semibold text-text-secondary md:w-36">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={{ pathname: "/projects", query: filterQuery(option.filters) }}
              aria-current={option.active ? "true" : undefined}
              scroll={false}
              className={cx(CHIP, option.active ? CHIP_ON : CHIP_OFF)}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Project cards. `organization` is already the general label when the name
 * is hidden: the real name never reaches this component (§6.6).
 */
export function ProjectCards({ projects, areas }: { projects: Project[]; areas: ExpertiseArea[] }) {
  const t = useTranslations("Catalog");
  const areaTitles = new Map(areas.map((area) => [area.id, area.title]));

  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const area = project.expertiseId ? areaTitles.get(project.expertiseId) : undefined;
        return (
          <li key={project.id} className={cx(CARD, "flex flex-col")}>
            {project.organization && (
              <p className="text-sm font-semibold text-text-secondary">{project.organization}</p>
            )}
            <h2 className="mt-1 text-xl">
              <Link href={`/projects/${project.slug}`} className={CARD_LINK}>
                {project.title}
              </Link>
            </h2>
            <p className="mt-3 line-clamp-3 text-pretty text-text-secondary">{project.goal}</p>
            {area && <p className="mt-3 text-sm text-text-secondary">{area}</p>}
            {project.keyResult && (
              <p className="mt-auto border-s-2 border-accent ps-3 pt-4">
                <span className="block text-xs font-semibold text-text-secondary">{t("keyResult")}</span>
                <span className="mt-0.5 block font-semibold">{project.keyResult}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * `/projects` below its hero: filters by expertise area and organization type
 * (§6.6), then the matching projects. Only filters that match a project show.
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

  const areaOptions: Option[] = [
    { key: "all", label: t("filterAll"), filters: { ...filters, area: null }, active: filters.area === null },
    ...usedAreas.map((area) => ({
      key: area.id,
      label: area.title,
      filters: { ...filters, area: area.slug },
      active: filters.area === area.slug,
    })),
  ];
  const typeOptions: Option[] = [
    { key: "all", label: t("filterAll"), filters: { ...filters, orgType: null }, active: filters.orgType === null },
    ...usedTypes.map((type) => ({
      key: type,
      label: t(`orgType.${type}`),
      filters: { ...filters, orgType: type },
      active: filters.orgType === type,
    })),
  ];

  return (
    <div className={cx(CONTAINER, "py-12 md:py-16")}>
      <nav aria-label={t("filtersLabel")} className="flex flex-col gap-4 border-b border-text/10 pb-6">
        {usedAreas.length > 0 && <FilterGroup id="filter-area" label={t("filterArea")} options={areaOptions} />}
        {usedTypes.length > 0 && <FilterGroup id="filter-type" label={t("filterOrgType")} options={typeOptions} />}
      </nav>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm font-semibold text-text-secondary">
          {t("resultCount", { count: shown.length })}
        </p>
        {filtered && (
          <Link
            href="/projects"
            scroll={false}
            className="rounded-sm text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("clearFilters")}
          </Link>
        )}
      </div>
      <div className="mt-6">
        {shown.length === 0 ? <EmptyNote text={t("noProjects")} /> : <ProjectCards projects={shown} areas={areas} />}
      </div>
    </div>
  );
}
