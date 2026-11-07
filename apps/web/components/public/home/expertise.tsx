import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea } from "@/lib/content";
import { CARD, CARD_LINK, HomeSectionShell, type SectionBand } from "./section";

/** §6.2 #3: three cards. */
export const HOME_EXPERTISE_COUNT = 3;

export function ExpertiseSection({
  heading,
  intro,
  band,
  areas,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  areas: ExpertiseArea[];
}) {
  const t = useTranslations("Home");

  return (
    <HomeSectionShell
      sectionKey="expertise"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/expertise", label: t("allExpertise") }}
    >
      <ul className="grid gap-6 md:grid-cols-3">
        {areas.slice(0, HOME_EXPERTISE_COUNT).map((area) => (
          <li key={area.id} className={cx(CARD, "relative border-t-4 border-t-accent")}>
            <h3 className="text-xl">
              <Link href={`/expertise/${area.slug}`} className={CARD_LINK}>
                {area.title}
              </Link>
            </h3>
            <p className="mt-3 text-pretty text-text-secondary">{area.summary}</p>
          </li>
        ))}
      </ul>
    </HomeSectionShell>
  );
}
