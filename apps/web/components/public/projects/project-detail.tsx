import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, ProjectDetail } from "@/lib/content";
import { ContactSheet, type SheetImage } from "../listing/media-frame";
import { RecordRow } from "../project-story";
import { AREA_PARAM } from "./filters";
import { activityRows, resultLines, type LabelledLine, type ResultFigure } from "./lines";
import { CONTAINER, PageHero } from "../parts";

/*
 * The ProjectPage board's parts: the facts line, the activities, results in
 * numbers and the contact-sheet gallery. Each is exported for the
 * design-system page and the Lane B page.
 */

export type ProjectFact = { label: string; value: ReactNode };

/** Goal, organization, role, duration: one row of facts under the 2px rule, stacked on phones. */
export function ProjectFacts({ facts, className }: { facts: ProjectFact[]; className?: string }) {
  if (facts.length === 0) return null;
  return (
    <dl className={cx("grid border-t-2 border-rule sm:grid-cols-2 lg:grid-cols-4", className)}>
      {facts.map((fact, index) => (
        <div
          key={index}
          className={cx(
            "flex flex-col gap-0.5 border-b border-line py-3.5",
            "sm:[&:nth-child(2n)]:border-s sm:[&:nth-child(2n)]:ps-5",
            "lg:[&:not(:first-child)]:border-s lg:[&:not(:first-child)]:ps-5",
          )}
        >
          <dt className="text-ink-2 type-caption">{fact.label}</dt>
          <dd className="text-pretty type-small">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Activities as dated rows: the time label in a narrow column, then what happened. */
export function ActivityList({ rows, className }: { rows: LabelledLine[]; className?: string }) {
  if (rows.length === 0) return null;
  const labelled = rows.some((row) => row.label);
  return (
    <ol className={cx("border-t border-line", className)}>
      {rows.map((row, index) => (
        <li
          key={index}
          className={cx(
            "grid gap-1 border-b border-line py-2.5 text-[15px] leading-[1.8] sm:gap-5",
            labelled && "sm:grid-cols-[90px_minmax(0,1fr)]",
          )}
        >
          {labelled && <span className="text-[13px] text-ink-2 tabular-nums">{row.label}</span>}
          <span className="text-pretty">{row.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Results in numbers: the figure large, what it means under it, and where it started when known. */
export function ResultFigures({
  figures,
  columns = 2,
  className,
}: {
  figures: (ResultFigure & { from?: string | null })[];
  columns?: 2 | 3;
  className?: string;
}) {
  if (figures.length === 0) return null;
  return (
    <ul className={cx("grid gap-x-8 gap-y-6 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3", className)}>
      {figures.map((figure, index) => (
        <li key={index} className="flex flex-col gap-1.5 border-t border-line pt-3.5">
          <b className="text-[44px] leading-[1.1] font-medium tabular-nums">{figure.value}</b>
          <span className="text-pretty type-small">{figure.text}</span>
          {figure.from && <span className="text-[13px] text-ink-2">{figure.from}</span>}
        </li>
      ))}
    </ul>
  );
}

function Part({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <h2 id={id} className="text-ink-2 type-small">
        {title}
      </h2>
      {children}
    </section>
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
  const tg = useTranslations("ContentWork.gallery");

  const facts = ([
    { label: t("goal"), value: project.goal },
    project.organization ? { label: t("organization"), value: project.organization } : null,
    area
      ? {
          label: t("filterArea"),
          value: (
            <Link
              href={{ pathname: "/projects", query: { [AREA_PARAM]: area.slug } }}
              className="text-accent underline decoration-1 underline-offset-5 transition-state hover:decoration-2 focus-ring"
            >
              {area.title}
            </Link>
          ),
        }
      : null,
    project.role ? { label: t("role"), value: project.role } : null,
    project.duration ? { label: t("duration"), value: project.duration } : null,
  ] as (ProjectFact | null)[]).filter((fact): fact is ProjectFact => fact !== null);

  const activities = activityRows(project.activities);
  const { figures, rest } = resultLines(project.results);
  const images: SheetImage[] = project.images.map((image, index) => ({
    src: image.url,
    alt: image.alt ?? t("photoAlt", { title: project.title }),
    caption: image.alt ?? tg("photo", { n: index + 1 }),
  }));
  const hasResults = Boolean(project.keyResult || figures.length > 0 || rest.length > 0);

  return (
    <>
      <PageHero
        back={{ href: "/projects", label: t("allProjects") }}
        eyebrow={tNav("projects")}
        title={project.title}
        intro={project.organization ?? undefined}
      />
      <div className={cx(CONTAINER, "flex flex-col gap-9 py-12 md:py-16")}>
        <ProjectFacts facts={facts} />
        {(activities.length > 0 || hasResults) && (
          <div className="grid gap-9 lg:grid-cols-2 lg:gap-8">
            {activities.length > 0 && (
              <Part id="project-activities" title={t("activities")}>
                <ActivityList rows={activities} />
              </Part>
            )}
            {hasResults && (
              <Part id="project-results" title={t("results")}>
                {project.keyResult && (
                  <dl className="border-t border-line">
                    <RecordRow label={t("keyResult")} changed>
                      {project.keyResult}
                    </RecordRow>
                  </dl>
                )}
                <ResultFigures figures={figures} className="mt-3" />
                {rest.length > 0 && <ActivityList rows={rest.map((text) => ({ label: null, text }))} className="mt-3" />}
              </Part>
            )}
          </div>
        )}
        {images.length > 0 && (
          <Part id="project-photos" title={t("photos")}>
            <ContactSheet
              images={images}
              labels={{
                open: images.map((_, index) => tg("open", { n: index + 1 })),
                close: tg("close"),
                previous: tg("previous"),
                next: tg("next"),
                position: images.map((_, index) => tg("position", { n: index + 1, total: images.length })),
                missing: tg("missing"),
              }}
            />
          </Part>
        )}
      </div>
    </>
  );
}
