import { useTranslations } from "next-intl";
import { ServiceRows } from "@/components/public/pages/identity";
import type { Service } from "@/lib/content";
import { HomeSectionShell } from "./section";

/** §6.2 #5. Takes the featured services only, as an index (the ServiceList board); the first is open. */
export function ServicesSection({
  heading,
  intro,
  services,
}: {
  heading: string;
  intro?: string;
  services: Service[];
}) {
  const t = useTranslations("Home");

  return (
    <HomeSectionShell
      sectionKey="services"
      heading={heading}
      intro={intro}
      action={{ href: "/services", label: t("allServices") }}
    >
      <ServiceRows services={services} openId={services[0]?.id} />
    </HomeSectionShell>
  );
}
