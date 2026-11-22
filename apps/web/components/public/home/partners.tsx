import { useTranslations } from "next-intl";
import { OrganizationRegister } from "@/components/public/pages/identity";
import type { Partner } from "@/lib/content";
import { HomeSectionShell, type SectionBand } from "./section";

/**
 * §6.2 #7, as a register low on the page (the OrganizationLogos board), never
 * a wall. lib/content returns approved, consented partners only (§6.11).
 */
export function PartnersSection({
  heading,
  intro,
  band,
  partners,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  partners: Partner[];
}) {
  const t = useTranslations("Home");

  return (
    // "All organizations" sits in the section head, as on every other home
    // section (the Main mockup), not squeezed into a register cell.
    <HomeSectionShell
      sectionKey="partners"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/clients", label: t("allClients") }}
    >
      <OrganizationRegister partners={partners} />
    </HomeSectionShell>
  );
}
