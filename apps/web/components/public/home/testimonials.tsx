import { useTranslations } from "next-intl";
import { TestimonialSet } from "@/components/public/pages/identity";
import type { Testimonial } from "@/lib/content";
import { HomeSectionShell, type SectionBand } from "./section";

/**
 * §6.2 #8: one in full, the others as excerpts (the Testimonial board).
 * lib/content returns approved, consented testimonials only (§6.11).
 */
export function TestimonialsSection({
  heading,
  intro,
  band,
  testimonials,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
  testimonials: Testimonial[];
}) {
  const t = useTranslations("Home");
  const tIdentity = useTranslations("ContentIdentity");

  return (
    <HomeSectionShell
      sectionKey="testimonials"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/clients", label: t("allClients") }}
    >
      <TestimonialSet testimonials={testimonials} source={tIdentity("testimonial.source")} />
    </HomeSectionShell>
  );
}
