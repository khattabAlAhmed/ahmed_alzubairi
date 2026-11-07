/**
 * Projects pages (T06). Each takes its data as props, so the dashboard's
 * preview can render them with unsaved content.
 */
export { AREA_PARAM, filterProjects, filterQuery, ORG_TYPE_PARAM, parseProjectFilters, type ProjectFilters } from "./filters";
export { CARD, CONTAINER, EmptyNote, PageHero, PageSection } from "./parts";
export { ProjectDetailPage } from "./project-detail";
export { ProjectCards, ProjectsList } from "./projects-list";
export { routeSlug, staticSlugs } from "./static-slugs";
