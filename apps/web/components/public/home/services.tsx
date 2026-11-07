import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/content";
import { CARD, CARD_LINK, HomeSectionShell, type SectionBand } from "./section";

/** §6.2 #5. Takes the featured services only. */
export function ServicesSection({
  heading,
  intro,
  band,
  services,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  services: Service[];
}) {
  const t = useTranslations("Home");

  return (
    <HomeSectionShell
      sectionKey="services"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/services", label: t("allServices") }}
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <li key={service.id} className={cx(CARD, "relative")}>
            <h3 className="text-xl">
              <Link href={`/services/${service.slug}`} className={CARD_LINK}>
                {service.title}
              </Link>
            </h3>
            <p className="mt-3 text-pretty text-text-secondary">{service.summary}</p>
          </li>
        ))}
      </ul>
    </HomeSectionShell>
  );
}
