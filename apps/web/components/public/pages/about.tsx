import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import type { Page, TimelineItem } from "@/lib/content";
import { RichText, splitLead } from "../rich-text";
import { CONTAINER, ConsultationCta, PageHero, PageSection, RING_ON_NAVY } from "../parts";

/**
 * §6.3. The title is the h1 and the body's first paragraph the short bio. The
 * rest of the body is the long bio, where the editor writes the "Values" and
 * "Working method" headings. Career and qualifications come from the timeline.
 */
export function AboutPage({
  page,
  timeline,
  cvUrl,
}: {
  page: Page;
  timeline: TimelineItem[];
  /** Set only when site settings make the CV visible. */
  cvUrl: string | null;
}) {
  const t = useTranslations("Pages");
  const { lead, rest } = splitLead(page.body);
  const career = timeline.filter((item) => item.kind === "career");
  const qualifications = timeline.filter((item) => item.kind === "qualification");

  return (
    <>
      <PageHero
        title={page.title}
        intro={lead ? <RichText doc={lead} /> : undefined}
        actions={
          cvUrl ? (
            <a href={cvUrl} download className={buttonClasses({ size: "lg", className: RING_ON_NAVY })}>
              {t("downloadCv")}
            </a>
          ) : undefined
        }
      />
      <div
        className={cx(
          CONTAINER,
          "grid gap-14 py-12 md:py-16",
          rest && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        {rest && <RichText doc={rest} className="max-w-prose text-lg" />}
        {(career.length > 0 || qualifications.length > 0) && (
          <div className={cx("grid content-start gap-12", !rest && "md:grid-cols-2")}>
            {career.length > 0 && <Timeline id="about-career" title={t("career")} items={career} />}
            {qualifications.length > 0 && (
              <Timeline id="about-qualifications" title={t("qualifications")} items={qualifications} />
            )}
          </div>
        )}
      </div>
      <ConsultationCta />
    </>
  );
}

function Timeline({ id, title, items }: { id: string; title: string; items: TimelineItem[] }) {
  return (
    <PageSection id={id} title={title}>
      <ol className="space-y-6 border-s-2 border-text/15 ps-6">
        {items.map((item) => (
          <li key={item.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -start-[1.95rem] top-1.5 size-3 rounded-full border-2 border-accent bg-background"
            />
            {item.period && (
              <p className="text-sm font-semibold text-text-secondary">
                <bdi>{item.period}</bdi>
              </p>
            )}
            <h3 className="mt-0.5 text-lg">{item.title}</h3>
            {item.description && <p className="mt-1 text-pretty text-text-secondary">{item.description}</p>}
          </li>
        ))}
      </ol>
    </PageSection>
  );
}
