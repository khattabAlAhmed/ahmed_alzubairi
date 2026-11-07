import { orgTypeSchema, type OrgType } from "@repo/shared";
import type { ExpertiseArea, Project } from "@/lib/content";

/**
 * The projects list filters (§6.6), kept in the URL query so a filtered list
 * can be shared, and the language switch keeps it. Slugs and org types are
 * the same in both languages.
 */
export const AREA_PARAM = "area";
export const ORG_TYPE_PARAM = "type";

export type ProjectFilters = { area: string | null; orgType: OrgType | null };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  return item && item.trim() !== "" ? item : null;
}

/** Reads the filters from the query. An unknown org type means no filter. */
export function parseProjectFilters(params: SearchParams): ProjectFilters {
  const orgType = orgTypeSchema.safeParse(first(params[ORG_TYPE_PARAM]));
  return {
    area: first(params[AREA_PARAM]),
    orgType: orgType.success ? orgType.data : null,
  };
}

/** Projects that match both filters. An area that doesn't exist matches nothing. */
export function filterProjects(
  projects: Project[],
  areas: ExpertiseArea[],
  filters: ProjectFilters,
): Project[] {
  const areaId = filters.area === null ? null : (areas.find((area) => area.slug === filters.area)?.id ?? "");
  return projects.filter(
    (project) =>
      (areaId === null || project.expertiseId === areaId) &&
      (filters.orgType === null || project.orgType === filters.orgType),
  );
}

/** The query for a filter link. A null value drops that filter. */
export function filterQuery(filters: ProjectFilters): Record<string, string> {
  return {
    ...(filters.area ? { [AREA_PARAM]: filters.area } : {}),
    ...(filters.orgType ? { [ORG_TYPE_PARAM]: filters.orgType } : {}),
  };
}
