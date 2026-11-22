import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import type { ExpertiseArea, ProjectDetail, Service } from "@/lib/content";
import { ContactSheet, type SheetImage } from "../listing/media-frame";
import { RecordRow } from "../project-story";
import { AREA_PARAM } from "./filters";
import { activityRows, resultLines, type LabelledLine, type ResultFigure } from "./lines";
import { CONTAINER, ConsultationCta, MoreLink, PageHero, PageSection, type PageFact } from "../parts";

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
    <dl className={cx("grid border-t-2 border-rule sm:grid-cols-2 lg:flex", className)}>
      {facts.map((fact, index) => (
        <div
          key={index}
          className={cx(
            "flex flex-col gap-0.5 border-b border-line py-3.5 lg:min-w-0 lg:flex-1",
            "sm:max-lg:[&:nth-child(2n)]:border-s sm:max-lg:[&:nth-child(2n)]:ps-5",
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

/**
 * `/projects/[slug]` (the ProjectPage board): the header with the area and
 * service, the facts, the cover, the story as a record (الحال ← goal, ما فعلتُ
 * ← role, ما تغيّر ← key result) beside its links, results in numbers, how the
 * work went beside the gallery, then the invitation. `organization` is the
 * general label when the name is hidden; the real name never reaches this
 * component, only `organizationHidden`, which adds a note.
 */
export function ProjectDetailPage({
  project,
  area,
  services = [],
}: {
  project: ProjectDetail;
  /** The project's expertise area, when it's published in this language. */
  area: ExpertiseArea | null;
  /** The project's services published in this language. */
  services?: Pick<Service, "slug" | "title">[];
}) {
  const t = useTranslations("Catalog");
  const tp = useTranslations("Catalog.projectPage");
  const tg = useTranslations("ContentWork.gallery");
  const tr = useTranslations("ContentWork.record");
  const locale = useLocale();

  const header = [
    area ? { label: tp("area"), value: area.title } : null,
    services.length > 0
      ? { label: tp("service"), value: services.map((service) => service.title).join(locale === "ar" ? "، " : ", ") }
      : null,
  ].filter((fact): fact is PageFact => fact !== null);

  const facts = ([
    project.organization ? { label: tp("client"), value: project.organization } : null,
    project.duration ? { label: t("duration"), value: project.duration } : null,
  ] as (ProjectFact | null)[]).filter((fact): fact is ProjectFact => fact !== null);

  const activities = activityRows(project.activities);
  const { figures, rest } = resultLines(project.results);
  const [cover, ...gallery] = project.images;
  const sheet: SheetImage[] = gallery.map((image, index) => ({
    src: image.url,
    alt: image.alt ?? t("photoAlt", { title: project.title }),
    caption: image.alt ?? tg("photo", { n: index + 2 }),
  }));
  const links = [
    ...services.map((service) => ({ href: `/services/${service.slug}`, label: tp("serviceLink", { title: service.title }) })),
    ...(area ? [{ href: `/projects?${AREA_PARAM}=${encodeURIComponent(area.slug)}`, label: tp("areaLink", { title: area.title }) }] : []),
  ];

  return (
    <>
      <PageHero
        back={{ href: "/projects", label: t("allProjects") }}
        title={project.title}
        facts={header}
      />
      <div className={cx(CONTAINER, "flex flex-col gap-section")}>
        <div className="flex flex-col gap-8">
          <ProjectFacts facts={facts} />
          {cover && (
            <figure className="flex flex-col gap-2">
              <div className="relative aspect-[3/2] bg-surface md:aspect-[21/9]">
                <Image
                  src={cover.url}
                  alt={cover.alt ?? t("photoAlt", { title: project.title })}
                  fill
                  priority
                  sizes="(min-width: 1408px) 1312px, 100vw"
                  className="object-cover"
                />
              </div>
              {cover.alt && <figcaption className="text-ink-2 type-caption">{cover.alt}</figcaption>}
            </figure>
          )}
        </div>

        <section aria-labelledby="project-story" className="grid gap-8 md:grid-cols-12 md:gap-gutter">
          <div className="min-w-0 md:col-span-8">
            <h2 id="project-story" className="mb-2 type-h2">
              {tp("story")}
            </h2>
            <dl className="border-t-2 border-rule">
              <RecordRow label={tr("situation")}>{project.goal}</RecordRow>
              {project.role && <RecordRow label={tr("whatIDid")}>{project.role}</RecordRow>}
              {project.keyResult && (
                <RecordRow label={tr("whatChanged")} changed>
                  {project.keyResult}
                </RecordRow>
              )}
            </dl>
          </div>
          {(links.length > 0 || project.organizationHidden) && (
            <aside className="flex flex-col gap-4 md:col-span-4 md:pt-11">
              {links.length > 0 && (
                <ul className="border-t-2 border-rule">
                  {links.map((link) => (
                    <li key={link.href} className="border-b border-line py-3">
                      <MoreLink href={link.href} label={link.label} />
                    </li>
                  ))}
                </ul>
              )}
              {project.organizationHidden && <p className="text-ink-2 type-caption">{tp("hiddenName")}</p>}
            </aside>
          )}
        </section>

        {(figures.length > 0 || rest.length > 0) && (
          <PageSection id="project-results" title={tp("resultsTitle")}>
            <ResultFigures figures={figures} columns={3} />
            {rest.length > 0 && (
              <ActivityList rows={rest.map((text) => ({ label: null, text }))} className={figures.length > 0 ? "mt-6" : undefined} />
            )}
          </PageSection>
        )}

        {(activities.length > 0 || sheet.length > 0) && (
          <PageSection id="project-activities" title={tp("activitiesTitle")}>
            <div className={cx("grid gap-8", activities.length > 0 && sheet.length > 0 && "lg:grid-cols-12 lg:gap-gutter")}>
              {activities.length > 0 && <ActivityList rows={activities} className={sheet.length > 0 ? "lg:col-span-7" : undefined} />}
              {sheet.length > 0 && (
                <div className={activities.length > 0 ? "lg:col-span-5" : undefined}>
                  <ContactSheet
                    images={sheet}
                    labels={{
                      open: sheet.map((_, index) => tg("open", { n: index + 2 })),
                      close: tg("close"),
                      previous: tg("previous"),
                      next: tg("next"),
                      position: sheet.map((_, index) => tg("position", { n: index + 1, total: sheet.length })),
                      missing: tg("missing"),
                    }}
                  />
                </div>
              )}
            </div>
          </PageSection>
        )}
      </div>
      <ConsultationCta />
    </>
  );
}
