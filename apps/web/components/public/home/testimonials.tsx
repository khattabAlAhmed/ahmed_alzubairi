import { useTranslations } from "next-intl";
import type { Testimonial } from "@/lib/content";
import { CARD, HomeSectionShell, type SectionBand } from "./section";

/** §6.2 #8. lib/content returns approved, consented testimonials only (§6.11). */
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

  return (
    <HomeSectionShell
      sectionKey="testimonials"
      heading={heading}
      intro={intro}
      band={band}
      action={{ href: "/clients", label: t("allClients") }}
    >
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <li key={testimonial.id} className={CARD}>
            <figure className="flex h-full flex-col">
              <span aria-hidden="true" className="font-heading text-5xl leading-none text-text/25">
                &ldquo;
              </span>
              <blockquote className="mt-2 flex-1 text-pretty text-lg">{testimonial.quote}</blockquote>
              <figcaption className="mt-5 border-t border-text/10 pt-4 text-sm">
                <span className="block font-semibold">{testimonial.author}</span>
                {testimonial.organization && (
                  <span className="block text-text-secondary">{testimonial.organization}</span>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </HomeSectionShell>
  );
}
