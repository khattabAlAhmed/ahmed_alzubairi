import type { Project } from "@/lib/content";

/** The organizations a set of projects served, once each, in project order. */
export function servedOrganizations(projects: Project[]): string[] {
  return [...new Set(projects.flatMap((project) => project.organization ?? []))];
}
