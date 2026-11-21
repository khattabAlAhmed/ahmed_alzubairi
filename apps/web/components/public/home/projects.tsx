import { useTranslations } from "next-intl";
import type { Project } from "@/lib/content";
import { ProjectStoryFeatured, ProjectStoryList, ProjectStoryRow, storyFromProject } from "../project-story";
import { HomeSectionShell, type SectionBand } from "./section";

/** §6.2 #6: three projects. */
export const HOME_PROJECT_COUNT = 3;

/**
 * Featured projects first, in their order, then the rest, up to three, so the
 * section stays full while fewer than three are featured.
 */
export function selectHomeProjects(projects: Project[], count = HOME_PROJECT_COUNT): Project[] {
  const featured = projects.filter((project) => project.isFeatured);
  const others = projects.filter((project) => !project.isFeatured);
  return [...featured, ...others].slice(0, count);
}

/**
 * The first project as a full record, the other two as story rows.
 * `organization` is already the general label when the name is hidden: the
 * real name never reaches this component (lib/content, §6.6).
 */
export function ProjectsSection({
  heading,
  intro,
  band,
  projects,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  projects: Project[];
}) {
  const t = useTranslations("Home");

  const [first, ...others] = selectHomeProjects(projects);

  return (
    <HomeSectionShell
      sectionKey="projects"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/projects", label: t("allProjects") }}
    >
      {first && (
        <div className="flex flex-col gap-10">
          <ProjectStoryFeatured story={storyFromProject(first)} headingLevel={3} />
          {others.length > 0 && (
            <ProjectStoryList>
              {others.map((project) => (
                <ProjectStoryRow key={project.id} story={storyFromProject(project)} headingLevel={3} />
              ))}
            </ProjectStoryList>
          )}
        </div>
      )}
    </HomeSectionShell>
  );
}
