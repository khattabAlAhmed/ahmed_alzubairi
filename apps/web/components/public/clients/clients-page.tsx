import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { CONTAINER, PageSection } from "@/components/public/parts";
import { OrganizationRegister, TestimonialSet } from "@/components/public/pages/identity";
import { cx } from "@/components/ui/cx";
import type { Partner, Testimonial } from "@/lib/content";

/**
 * `/clients` below its header: the testimonials first, one in full and the
 * others as excerpts (the Testimonial board), then the organizations as a
 * register (the OrganizationLogos board). lib/content returns only rows with
 * consent confirmed, admin approval and published (§6.11); a hidden
 * organization's name never reaches here.
 */
export function ClientsContent({ partners, testimonials }: { partners: Partner[]; testimonials: Testimonial[] }) {
  const t = useTranslations("Catalog.clientsPage");

  return (
    <div className={cx(CONTAINER, "flex flex-col gap-section")}>
      {partners.length === 0 && testimonials.length === 0 && (
        <EmptyState level={2} title={t("empty.title")} text={t("empty.text")} />
      )}
      {testimonials.length > 0 && (
        <section aria-labelledby="clients-testimonials">
          <h2 id="clients-testimonials" className="mb-2 type-h2">
            {t("testimonialsTitle")}
          </h2>
          <TestimonialSet testimonials={testimonials} source={t("source")} />
        </section>
      )}
      {partners.length > 0 && (
        <PageSection id="clients-logos" title={t("logosTitle")}>
          <OrganizationRegister partners={partners} />
        </PageSection>
      )}
    </div>
  );
}
