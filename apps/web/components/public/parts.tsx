import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ConsultationButton } from "@/components/consultation-button";
import { ArrowForwardIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { Project } from "@/lib/content";

/** The shared buttons' focus ring is navy, which vanishes on the navy band. */
export const RING_ON_NAVY = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent!";

export const CONTAINER = "mx-auto w-full max-w-7xl px-4";

const TEXT_LINK =
  "inline-flex items-center gap-1.5 rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

/** A card link whose whole card is the target. */
export const CARD_LINK =
  "rounded-sm after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const CARD = "relative rounded-lg border border-text/10 bg-surface p-6 shadow-sm";

/** The top of a page on the navy band (§13: deep navy and gold for these sections). */
export function PageHero({
  eyebrow,
  back,
  title,
  intro,
  actions,
}: {
  eyebrow?: string;
  back?: { href: string; label: string };
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="bg-primary text-on-primary">
      <div className={cx(CONTAINER, "py-12 md:py-16")}>
        {back && (
          <Link href={back.href} className={cx(TEXT_LINK, "mb-6 text-sm text-on-primary/85 focus-visible:outline-accent")}>
            {/* Points back: the forward arrow, turned around. */}
            <ArrowForwardIcon aria-hidden="true" className="size-4 rotate-180" />
            {back.label}
          </Link>
        )}
        {eyebrow && (
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-primary/85">
            <span aria-hidden="true" className="h-0.5 w-8 shrink-0 rounded-full bg-accent" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-3xl leading-tight md:text-5xl">{title}</h1>
        {intro && <div className="mt-4 max-w-prose text-pretty text-lg text-on-primary/85">{intro}</div>}
        {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}

/** A titled block in a page's body. */
export function PageSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <span aria-hidden="true" className="mb-3 block h-0.5 w-10 rounded-full bg-accent" />
      <h2 id={id} className="text-balance text-2xl md:text-3xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Plain text from a long-text field, keeping the editor's line breaks. */
export function TextBlock({ text }: { text: string }) {
  return <p className="max-w-prose whitespace-pre-line text-pretty leading-relaxed">{text}</p>;
}

/** A link to a section's list page, after its content. */
export function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={cx(TEXT_LINK, "focus-visible:outline-ring")}>
      {label}
      <ArrowForwardIcon aria-hidden="true" className="size-4" />
    </Link>
  );
}

/**
 * Project cards. `organization` is already the general label when the name
 * is hidden: the real name never reaches this component (§6.6).
 */
export function ProjectCards({ projects }: { projects: Project[] }) {
  const t = useTranslations("Pages");

  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id} className={cx(CARD, "flex flex-col")}>
          {project.organization && (
            <p className="text-sm font-semibold text-text-secondary">{project.organization}</p>
          )}
          <h3 className="mt-1 text-xl">
            <Link href={`/projects/${project.slug}`} className={CARD_LINK}>
              {project.title}
            </Link>
          </h3>
          {project.keyResult && (
            <p className="mt-auto border-s-2 border-accent ps-3 pt-4">
              <span className="block text-xs font-semibold text-text-secondary">{t("keyResult")}</span>
              <span className="mt-0.5 block font-semibold">{project.keyResult}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Ends a page with the way to a consultation request. */
export function ConsultationCta() {
  const t = useTranslations("Pages");

  return (
    <section aria-labelledby="page-cta-title" className="bg-primary text-on-primary">
      <div className={cx(CONTAINER, "flex flex-wrap items-center justify-between gap-6 py-12")}>
        <div className="min-w-0 flex-1 basis-72">
          <h2 id="page-cta-title" className="text-2xl md:text-3xl">
            {t("ctaTitle")}
          </h2>
          <p className="mt-2 text-on-primary/85">{t("ctaText")}</p>
        </div>
        <ConsultationButton className={`h-12! px-6! text-lg! ${RING_ON_NAVY}`} />
      </div>
    </section>
  );
}

/** What a list page shows when nothing is published in this language. */
export function EmptyNote({ text }: { text: string }) {
  return <p className="text-text-secondary">{text}</p>;
}
