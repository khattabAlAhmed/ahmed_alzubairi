import { useTranslations } from "next-intl";
import { CONTAINER, EmptyNote, PageSection } from "@/components/public/parts";
import { OrganizationRegister, TestimonialSet } from "@/components/public/pages/identity";
import { cx } from "@/components/ui/cx";
import type { Partner, Testimonial } from "@/lib/content";

/**
 * `/clients` below its hero: the organizations as a register (the
 * OrganizationLogos board), then the testimonials, one in full and the others
 * as excerpts (the Testimonial board). lib/content returns only rows with
 * consent confirmed, admin approval and published (§6.11); a hidden
 * organization's name never reaches here.
 */
export function ClientsContent({ partners, testimonials }: { partners: Partner[]; testimonials: Testimonial[] }) {
  const t = useTranslations("Catalog");
  const tIdentity = useTranslations("ContentIdentity");

  return (
    <div className={cx(CONTAINER, "mt-section flex flex-col gap-section")}>
      {partners.length === 0 && testimonials.length === 0 && <EmptyNote text={t("noClients")} />}
      {testimonials.length > 0 && (
        <PageSection id="clients-testimonials" title={t("testimonials")}>
          <TestimonialSet testimonials={testimonials} source={tIdentity("testimonial.source")} />
        </PageSection>
      )}
      {partners.length > 0 && (
        <PageSection id="clients-logos" title={t("logos")}>
          <OrganizationRegister partners={partners} />
        </PageSection>
      )}
    </div>
  );
}
