import { useTranslations } from "next-intl";
import { ExpertiseChapters } from "@/components/public/pages/identity";
import type { ExpertiseArea } from "@/lib/content";
import { HomeSectionShell } from "./section";

/** §6.2 #3: the three areas, as chapters (the ExpertiseArea board). */
export const HOME_EXPERTISE_COUNT = 3;

export function ExpertiseSection({
  heading,
  intro,
  areas,
}: {
  heading: string;
  intro?: string;
  areas: ExpertiseArea[];
}) {
  const t = useTranslations("Home");

  return (
    <HomeSectionShell
      sectionKey="expertise"
      heading={heading}
      intro={intro}
      action={{ href: "/expertise", label: t("allExpertise") }}
    >
      <ExpertiseChapters areas={areas.slice(0, HOME_EXPERTISE_COUNT)} />
    </HomeSectionShell>
  );
}
