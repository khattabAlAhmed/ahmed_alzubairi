import type { Project } from "@/lib/content";

/** The organizations a set of projects served, once each, in project order. */
export function servedOrganizations(projects: readonly Project[]): string[] {
  return [...new Set(projects.flatMap((project) => project.organization ?? []))];
}

/** An area's counts for its ledger: its projects and the organizations they served. */
export function areaFacts(projects: readonly Project[]): { projects: number; organizations: number } {
  return { projects: projects.length, organizations: servedOrganizations(projects).length };
}
