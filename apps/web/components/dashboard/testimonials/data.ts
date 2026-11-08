import "server-only";
import type { Locale } from "@repo/shared";
import { loadRows } from "../content/data";
import type { RefOption } from "../content/field-text";
import { rowTitle } from "../content/form-values";
import { toTrustRow, type TrustRow } from "./rows";

export type TrustData = {
  testimonials: TrustRow[];
  partners: TrustRow[];
  /** The partners a testimonial can link to, named in the page language. */
  partnerOptions: RefOption[];
};

/**
 * Testimonials and logos for the dashboard, read with the member's own
 * client: RLS lets in `content.manage` or `testimonials.approve`. Rows come
 * in their set order. Letter paths are dropped here, on the server.
 */
export async function loadTrust(locale: Locale, untitled: string): Promise<TrustData> {
  const [testimonials, partners] = await Promise.all([
    loadRows("testimonials"),
    loadRows("partners"),
  ]);
  return {
    testimonials: testimonials.map(toTrustRow),
    partners: partners.map(toTrustRow),
    partnerOptions: partners.map((row) => ({
      id: String(row.id),
      title: rowTitle("partners", row, locale) ?? untitled,
    })),
  };
}
