import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Partner } from "@/lib/content";
import { CARD, HomeSectionShell, type SectionBand } from "./section";

/** §6.2 #7. lib/content returns approved, consented partners only (§6.11). */
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
    <HomeSectionShell
      sectionKey="partners"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/clients", label: t("allClients") }}
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {partners.map((partner) => (
          <li key={partner.id} className={`${CARD} flex h-28 items-center justify-center p-4! text-center`}>
            {partner.logoUrl ? (
              <span className="relative block h-full w-full">
                <Image
                  src={partner.logoUrl}
                  alt={t("partnerLogo", { name: partner.name })}
                  fill
                  sizes="(min-width: 1024px) 12rem, (min-width: 640px) 30vw, 45vw"
                  className="object-contain"
                />
              </span>
            ) : (
              <span className="text-pretty font-semibold text-text-secondary">{partner.name}</span>
            )}
          </li>
        ))}
      </ul>
    </HomeSectionShell>
  );
}
