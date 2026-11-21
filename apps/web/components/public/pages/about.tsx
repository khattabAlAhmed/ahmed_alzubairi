import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import type { Page, TimelineItem } from "@/lib/content";
import { RichText, splitLead } from "../rich-text";
import { CONTAINER, ConsultationCta, PageHero, PageSection } from "../parts";
import { CareerTimeline, CvLink, QualificationList } from "./identity";

/**
 * §6.3. The title is the h1 and the body's first paragraph the short bio. The
 * rest of the body is the long bio, where the editor writes the "Values" and
 * "Working method" headings. Career (a spine, the CareerTimeline board) and
 * qualifications with the CV (the Qualifications board) come from the
 * timeline and site settings.
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
  const hasRecord = career.length > 0 || qualifications.length > 0 || cvUrl;

  return (
    <>
      <PageHero title={page.title} intro={lead ? <RichText doc={lead} /> : undefined} />
      <div className={cx(CONTAINER, "mt-section grid gap-section")}>
        {rest && <RichText doc={rest} className="max-w-measure" />}
        {hasRecord && (
          <div className="grid gap-x-12 gap-y-section lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {career.length > 0 && (
              <PageSection id="about-career" title={t("career")}>
                <CareerTimeline items={career} />
              </PageSection>
            )}
            {(qualifications.length > 0 || cvUrl) && (
              <PageSection id="about-qualifications" title={t("qualifications")}>
                <div className="flex flex-col gap-6">
                  {qualifications.length > 0 && <QualificationList items={qualifications} />}
                  {cvUrl && <CvLink href={cvUrl} label={t("downloadCv")} />}
                </div>
              </PageSection>
            )}
          </div>
        )}
      </div>
      <ConsultationCta />
    </>
  );
}
