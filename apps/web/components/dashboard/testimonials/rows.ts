import type { Row } from "../content/form-values";

/** The two types this page lists. Both need consent and the admin's approval (§6.11). */
export type TrustType = "testimonials" | "partners";

/** A testimonial or logo as the browser gets it: no letter path, only whether there is one. */
export type TrustRow = { row: Row; hasLetter: boolean };

/**
 * Drops `letterKey` before a row reaches the browser (§9). The letter opens
 * only through the signed-URL route; the editor keeps the saved letter
 * because an update leaves out the fields it isn't sent.
 */
export function toTrustRow(row: Row): TrustRow {
  const { letterKey, ...rest } = row;
  return {
    row: rest,
    hasLetter: typeof letterKey === "string" && letterKey !== "",
  };
}

/** Why a row can't go public yet: the missing consent, the missing approval, or both. */
export function trustBlockers(row: Row): ("no_consent" | "not_approved")[] {
  const blockers: ("no_consent" | "not_approved")[] = [];
  if (row.consentConfirmed !== true) blockers.push("no_consent");
  if (row.adminApproved !== true) blockers.push("not_approved");
  return blockers;
}
