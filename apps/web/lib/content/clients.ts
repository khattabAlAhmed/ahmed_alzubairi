import "server-only";
import { contentCacheTag, type Locale } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { hasPublicConsent, isPublicIn, publicMediaUrl, rowsOrThrow, text } from "./rows";
import type { Partner, Testimonial } from "./types";

type PartnerRow = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  logo_path: string | null;
  consent_confirmed: boolean;
  admin_approved: boolean;
  position: number;
  status: string;
};

const PARTNER_COLUMNS =
  "id, name_ar, name_en, logo_path, consent_confirmed, admin_approved, position, status";

async function readPublicPartners(): Promise<PartnerRow[]> {
  const rows = rowsOrThrow<PartnerRow>(
    await createServiceClient()
      .from("partners")
      .select(PARTNER_COLUMNS)
      .eq("status", "published")
      .eq("consent_confirmed", true)
      .eq("admin_approved", true)
      .order("position"),
    "partners",
  );
  return rows.filter(hasPublicConsent);
}

/** Organization logos: consented, approved and published only (§6.11). */
export async function getPartners(locale: Locale): Promise<Partner[]> {
  "use cache";
  cacheTag(contentCacheTag("partners"));
  cacheLife("hours");

  return (await readPublicPartners()).flatMap((row) => {
    const name = text(row, "name", locale);
    if (!isPublicIn("partners", row, locale) || !name) return [];
    return [{ id: row.id, name, logoUrl: publicMediaUrl(row.logo_path) }];
  });
}

type TestimonialRow = {
  id: string;
  quote_ar: string | null;
  quote_en: string | null;
  author_ar: string | null;
  author_en: string | null;
  partner_id: string | null;
  consent_confirmed: boolean;
  admin_approved: boolean;
  position: number;
  status: string;
};

// `letter_path` is never selected: the source letter stays internal (§6.11).
const TESTIMONIAL_COLUMNS =
  "id, quote_ar, quote_en, author_ar, author_en, partner_id, consent_confirmed, admin_approved, position, status";

/** Testimonials: consented, approved and published only (§6.11). */
export async function getTestimonials(locale: Locale): Promise<Testimonial[]> {
  "use cache";
  cacheTag(contentCacheTag("testimonials"), contentCacheTag("partners"));
  cacheLife("hours");

  const [rows, partners] = await Promise.all([
    createServiceClient()
      .from("testimonials")
      .select(TESTIMONIAL_COLUMNS)
      .eq("status", "published")
      .eq("consent_confirmed", true)
      .eq("admin_approved", true)
      .order("position")
      .then((result) => rowsOrThrow<TestimonialRow>(result, "testimonials")),
    readPublicPartners(),
  ]);
  // A partner's name shows only when the partner itself is public.
  const partnerNames = new Map(
    partners.flatMap((partner) => {
      const name = isPublicIn("partners", partner, locale) ? text(partner, "name", locale) : null;
      return name ? [[partner.id, name] as const] : [];
    }),
  );

  return rows.filter(hasPublicConsent).flatMap((row) => {
    const quote = text(row, "quote", locale);
    const author = text(row, "author", locale);
    if (!isPublicIn("testimonials", row, locale) || !quote || !author) return [];
    return [
      {
        id: row.id,
        quote,
        author,
        organization: (row.partner_id && partnerNames.get(row.partner_id)) || null,
      },
    ];
  });
}
