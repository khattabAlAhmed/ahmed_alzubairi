import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import type { HomeStat, Page, TimelineItem } from "@/lib/content";
import { RichText, splitLead } from "../rich-text";
import { CONTAINER, ConsultationCta, PageHero, PageSection } from "../parts";
import { CareerTimeline, CvLink, QualificationList, StatLedger, ValueList } from "./identity";

/** His values and working method, in the order the mockup sets them (approved voice copy). */
const VALUES = ["listen", "doable", "leave"] as const;

/**
 * §6.3, as the About mockup. The page header carries the page's name, one
 * sentence of his, and the body's first paragraph (the short bio). "In
 * short" holds the rest of the body (the long bio) beside the quick stats as
 * a ledger. Then the career as a spine, and the qualifications with the CV
 * beside his values. Facts all come from the dashboard: the body, the
 * timeline, the stats, the CV switch and the portrait (the home hero's
 * photo). His sentence and his values are voice copy in `messages/`. A part
 * with nothing to show isn't rendered.
 */
export function AboutPage({
  page,
  timeline,
  stats,
  cvUrl,
  portrait,
}: {
  page: Page;
  timeline: TimelineItem[];
  /** The quick stats (`home_stats`), the same facts as the home page's ledger. */
  stats: HomeStat[];
  /** Set only when site settings make the CV visible. */
  cvUrl: string | null;
  /** The home hero's photo and his name, when the hero has a photo. */
  portrait: { src: string; name: string } | null;
}) {
  const t = useTranslations("Pages");
  const { lead, rest } = splitLead(page.body);
  const career = timeline.filter((item) => item.kind === "career");
  const qualifications = timeline.filter((item) => item.kind === "qualification");

  return (
    <>
      <PageHero
        eyebrow={page.title}
        title={t("aboutSentence")}
        intro={lead ? <RichText doc={lead} /> : undefined}
        photo={portrait ? { src: portrait.src, alt: t("portraitAlt", { name: portrait.name }) } : undefined}
      />
      <div className={cx(CONTAINER, "mt-section grid gap-section")}>
        {(rest || stats.length > 0) && (
          <section aria-labelledby="about-in-short" className="grid gap-x-gutter gap-y-6 md:grid-cols-12">
            <h2 id="about-in-short" className="type-small text-ink-2 md:col-span-3">
              {t("inShort")}
            </h2>
            {rest && <RichText doc={rest} className="max-w-measure md:col-span-9 lg:col-span-6" />}
            {stats.length > 0 && (
              <StatLedger
                stats={stats}
                className="self-start md:col-span-9 md:col-start-4 lg:col-span-3 lg:col-start-10"
              />
            )}
          </section>
        )}
        {career.length > 0 && (
          <PageSection id="about-career" title={t("career")} intro={t("careerIntro")}>
            <div className="md:w-2/3">
              <CareerTimeline items={career} label={t("career")} />
            </div>
          </PageSection>
        )}
        <PageSection
          id="about-qualifications"
          title={t("qualificationsAndMethod")}
          intro={t("qualificationsIntro")}
          more={{ href: "/documents", label: t("documentsLink") }}
        >
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {(qualifications.length > 0 || cvUrl) && (
              <div className="flex flex-col gap-5">
                {qualifications.length > 0 && <QualificationList items={qualifications} label={t("qualifications")} />}
                {cvUrl && <CvLink href={cvUrl} label={t("cv")} />}
              </div>
            )}
            <ValueList
              label={t("valuesLabel")}
              items={VALUES.map((key) => ({ term: t(`values.${key}.title`), definition: t(`values.${key}.text`) }))}
            />
          </div>
        </PageSection>
      </div>
      <ConsultationCta />
    </>
  );
}
