import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ArrowForwardIcon } from "@/components/icons";
import { Tag } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { Project } from "@/lib/content";

/*
 * The record (DESIGN.md "The record: the signature pattern"): a 2px rule, a
 * meta line, a title, then the label rows الحال / ما فعلتُ / ما تغيّر. "What
 * changed" is the one accent. A project reads as a short story, not a card.
 *
 * `organization` is always what lib/content gives: the general label when the
 * name is hidden (§6.6). The real name never reaches this component.
 */

export type ProjectStoryData = {
  href: string;
  title: string;
  /** Organization (or its general label), area, years: whichever are known. */
  meta: (string | null | undefined)[];
  situation?: string | null;
  whatIDid?: string | null;
  whatChanged?: string | null;
  /** The expertise area, as a tag on a list row. */
  area?: string | null;
  cover?: { src: string; alt: string } | null;
  /** A line under the photo of a featured story. */
  caption?: string | null;
};

/**
 * A project as story data. Today's fields map to the rows as: الحال ← goal,
 * ما تغيّر ← key result. "What I did" comes from the project page (its role)
 * when the caller has it.
 */
export function storyFromProject(
  project: Project,
  { area, whatIDid }: { area?: string | null; whatIDid?: string | null } = {},
): ProjectStoryData {
  return {
    href: `/projects/${project.slug}`,
    title: project.title,
    meta: [project.organization, area],
    situation: project.goal,
    whatIDid,
    whatChanged: project.keyResult,
    area,
    cover: project.coverUrl ? { src: project.coverUrl, alt: "" } : null,
  };
}

function Meta({ items, className }: { items: ProjectStoryData["meta"]; className?: string }) {
  const shown = items.filter((item): item is string => Boolean(item));
  if (shown.length === 0) return null;
  return (
    <p className={cx("flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 text-[13px] text-ink-2", className)}>
      {shown.map((item, index) => (
        <span key={index} className="tabular-nums">
          {item}
        </span>
      ))}
    </p>
  );
}

/** One label row of a record. `changed` is the accent row. */
export function RecordRow({ label, children, changed = false }: { label: string; children: ReactNode; changed?: boolean }) {
  return (
    <div className="grid grid-cols-[var(--label-col)_minmax(0,1fr)] gap-4 border-b border-line py-3.5 md:gap-6">
      <dt className={cx("text-sm", changed ? "font-medium text-accent" : "text-ink-2")}>{label}</dt>
      <dd className="text-pretty type-body">{children}</dd>
    </div>
  );
}

/** The record's rows, only those with text. */
function Rows({ story }: { story: ProjectStoryData }) {
  const t = useTranslations("ContentWork.record");
  if (!story.situation && !story.whatIDid && !story.whatChanged) return null;
  return (
    <dl>
      {story.situation && <RecordRow label={t("situation")}>{story.situation}</RecordRow>}
      {story.whatIDid && <RecordRow label={t("whatIDid")}>{story.whatIDid}</RecordRow>}
      {story.whatChanged && (
        <RecordRow label={t("whatChanged")} changed>
          {story.whatChanged}
        </RecordRow>
      )}
    </dl>
  );
}

/**
 * The featured story: the photo (3:2) beside the full record, on the home
 * page and at the top of the projects list. Without a photo, the record takes
 * the whole width.
 */
export function ProjectStoryFeatured({
  story,
  headingLevel = 2,
  className,
}: {
  story: ProjectStoryData;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useTranslations("ContentWork.record");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={cx("grid gap-6 md:grid-cols-12 md:gap-8", className)}>
      {story.cover && (
        <figure className="md:col-span-5">
          <div className="relative aspect-[3/2] bg-surface">
            <Image src={story.cover.src} alt={story.cover.alt} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
          </div>
          {story.caption && <figcaption className="pt-2 text-[13px] text-ink-2">{story.caption}</figcaption>}
        </figure>
      )}
      <div className={cx("border-t-2 border-rule", story.cover ? "md:col-span-7" : "md:col-span-12")}>
        <Meta items={story.meta} />
        <Heading className="py-4 type-h2">
          <Link href={story.href} className="no-underline transition-state hover:underline hover:underline-offset-7 hover:decoration-1 focus-ring">
            {story.title}
          </Link>
        </Heading>
        <Rows story={story} />
        <Link
          href={story.href}
          aria-label={t("readFullLabel", { title: story.title })}
          className="mt-3.5 inline-flex items-center gap-2 border-b border-current py-1 text-[15px] text-accent transition-state hover:text-ink focus-ring"
        >
          {t("readFull")}
          <ArrowForwardIcon aria-hidden="true" className="dir-icon size-4" />
        </Link>
      </div>
    </article>
  );
}

/**
 * One project as a row of the list: meta, title, what changed, the area. The
 * whole row is the link. Rows go inside `ProjectStoryList`.
 */
export function ProjectStoryRow({ story, headingLevel = 2 }: { story: ProjectStoryData; headingLevel?: 2 | 3 }) {
  const t = useTranslations("ContentWork.record");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const meta = story.meta.filter((item): item is string => Boolean(item) && item !== story.area);
  return (
    <li className="border-b border-line">
      <Link
        href={story.href}
        className={cx(
          "group grid gap-2 py-4 no-underline transition-state hover:bg-surface-hover focus-ring focus-visible:-outline-offset-2",
          "md:grid-cols-[2fr_5fr_4fr_auto] md:items-baseline md:gap-8",
        )}
      >
        <span className="text-ink-2 tabular-nums type-caption">{meta.join(" · ")}</span>
        <Heading className="type-h3 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-7">{story.title}</Heading>
        <span className="text-pretty text-[15px] leading-[1.8]">
          {story.whatChanged && (
            <>
              <b className="font-medium text-accent">{t("whatChangedLead")}</b> {story.whatChanged}
            </>
          )}
        </span>
        <span className="md:justify-self-end">{story.area && <Tag>{story.area}</Tag>}</span>
      </Link>
    </li>
  );
}

/** The list of story rows, opened by the 2px rule. */
export function ProjectStoryList({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul aria-label={label} className={cx("border-t-2 border-rule", className)}>
      {children}
    </ul>
  );
}
