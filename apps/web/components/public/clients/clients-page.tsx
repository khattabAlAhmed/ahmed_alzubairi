import Image from "next/image";
import { useTranslations } from "next-intl";
import { CARD, CONTAINER, EmptyNote, PageSection } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import type { Partner, Testimonial } from "@/lib/content";

/**
 * `/clients` below its hero: logos, then testimonials. lib/content returns
 * only rows with consent confirmed, admin approval and published (§6.11).
 */
export function ClientsContent({ partners, testimonials }: { partners: Partner[]; testimonials: Testimonial[] }) {
  const t = useTranslations("Catalog");

  return (
    <div className={cx(CONTAINER, "flex flex-col gap-16 py-12 md:py-16")}>
      {partners.length === 0 && testimonials.length === 0 && <EmptyNote text={t("noClients")} />}
      {partners.length > 0 && (
        <PageSection id="clients-logos" title={t("logos")}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {partners.map((partner) => (
              <li key={partner.id} className={cx(CARD, "flex h-28 items-center justify-center p-4! text-center")}>
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
        </PageSection>
      )}
      {testimonials.length > 0 && (
        <PageSection id="clients-testimonials" title={t("testimonials")}>
          <ul className="grid gap-6 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <li key={testimonial.id} className={CARD}>
                <figure className="flex h-full flex-col">
                  <blockquote className="whitespace-pre-line text-pretty text-lg leading-relaxed">
                    {testimonial.quote}
                  </blockquote>
                  <figcaption className="mt-auto border-s-2 border-accent ps-3 pt-5">
                    <span className="block font-semibold">{testimonial.author}</span>
                    {testimonial.organization && (
                      <span className="block text-sm text-text-secondary">{testimonial.organization}</span>
                    )}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </div>
  );
}
