import Image from "next/image";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, ProjectDetail } from "@/lib/content";
import { AREA_PARAM } from "./filters";
import { CONTAINER, PageHero, PageSection, TextBlock } from "./parts";

/** A fact in the side panel, shown only when it has a value. */
function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm font-semibold text-text-secondary">{label}</dt>
      <dd className="mt-1 text-pretty">{value}</dd>
    </div>
  );
}

/**
 * `/projects/[slug]`: goal, organization, role, duration, activities, results
 * in numbers and images (§6.6). `organization` is the general label when the
 * name is hidden; the real name never reaches this component.
 */
export function ProjectDetailPage({
  project,
  area,
}: {
  project: ProjectDetail;
  /** The project's expertise area, when it's published in this language. */
  area: ExpertiseArea | null;
}) {
  const t = useTranslations("Catalog");
  const tNav = useTranslations("Nav");
  const hasFacts = Boolean(project.organization || project.role || project.duration || area);

  return (
    <>
      <PageHero
        back={{ href: "/projects", label: t("allProjects") }}
        eyebrow={tNav("projects")}
        title={project.title}
        intro={project.organization ?? undefined}
      />
      <div className={cx(CONTAINER, "grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        {hasFacts && (
          <aside className="lg:col-start-2 lg:row-start-1">
            <dl className="flex flex-col gap-5 rounded-lg border border-text/10 bg-surface p-6 shadow-sm lg:sticky lg:top-24">
              <Fact label={t("organization")} value={project.organization} />
              {area && (
                <div>
                  <dt className="text-sm font-semibold text-text-secondary">{t("filterArea")}</dt>
                  <dd className="mt-1">
                    <Link
                      href={{ pathname: "/projects", query: { [AREA_PARAM]: area.slug } }}
                      className="rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {area.title}
                    </Link>
                  </dd>
                </div>
              )}
              <Fact label={t("role")} value={project.role} />
              <Fact label={t("duration")} value={project.duration} />
            </dl>
          </aside>
        )}
        <div className="flex min-w-0 flex-col gap-12 lg:col-start-1 lg:row-start-1">
          <PageSection id="project-goal" title={t("goal")}>
            <TextBlock text={project.goal} />
          </PageSection>
          {project.activities && (
            <PageSection id="project-activities" title={t("activities")}>
              <TextBlock text={project.activities} />
            </PageSection>
          )}
          {(project.keyResult || project.results) && (
            <PageSection id="project-results" title={t("results")}>
              {project.keyResult && (
                <p className="mb-5 border-s-2 border-accent ps-3 text-xl font-semibold">{project.keyResult}</p>
              )}
              {project.results && <TextBlock text={project.results} />}
            </PageSection>
          )}
          {project.images.length > 0 && (
            <PageSection id="project-photos" title={t("photos")}>
              <ul className="grid gap-4 sm:grid-cols-2">
                {project.images.map((image) => (
                  <li key={image.url} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-text/5">
                    <Image
                      src={image.url}
                      alt={image.alt ?? t("photoAlt", { title: project.title })}
                      fill
                      sizes="(min-width: 1024px) 28rem, (min-width: 640px) 45vw, 100vw"
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
            </PageSection>
          )}
        </div>
      </div>
    </>
  );
}
