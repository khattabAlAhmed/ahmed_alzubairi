import "server-only";
import type { Locale } from "@repo/shared";
import { getProject, getProjects, type Project } from "@/lib/content";

/**
 * Published projects linked to a service through `project_services`. The list
 * read doesn't carry service IDs, so each project's detail read (cached by
 * tag, like every lib/content read) supplies them.
 */
export async function getServiceProjects(serviceId: string, locale: Locale): Promise<Project[]> {
  const projects = await getProjects(locale);
  const details = await Promise.all(projects.map((project) => getProject(project.slug, locale)));
  return projects.filter((_, index) => details[index]?.serviceIds.includes(serviceId));
}

/** The organizations a set of projects served, once each, in project order. */
export function servedOrganizations(projects: Project[]): string[] {
  return [...new Set(projects.flatMap((project) => project.organization ?? []))];
}
