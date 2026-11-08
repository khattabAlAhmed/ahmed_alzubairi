import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Project } from "@/lib/content";
import { CARD_LINK, HomeSectionShell, type SectionBand } from "./section";

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

  return (
    <HomeSectionShell
      sectionKey="projects"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/projects", label: t("allProjects") }}
    >
      <ul className="grid gap-6 md:grid-cols-3">
        {selectHomeProjects(projects).map((project) => (
          <li
            key={project.id}
            className="relative flex flex-col overflow-hidden rounded-lg border border-text/10 bg-surface shadow-sm group-data-[band=raised]/band:bg-background"
          >
            {project.coverUrl && (
              <div className="relative aspect-[16/9] bg-text/5">
                <Image
                  src={project.coverUrl}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col p-6">
              {project.organization && (
                <p className="text-sm font-semibold text-text-secondary">{project.organization}</p>
              )}
              <h3 className="mt-1 text-xl">
                <Link href={`/projects/${project.slug}`} className={CARD_LINK}>
                  {project.title}
                </Link>
              </h3>
              {project.keyResult && (
                <div className="mt-auto pt-5">
                  <p className="border-s-2 border-accent ps-3">
                    <span className="block text-xs font-semibold text-text-secondary">
                      {t("keyResult")}
                    </span>
                    <span className="mt-0.5 block text-lg font-semibold">{project.keyResult}</span>
                  </p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </HomeSectionShell>
  );
}
