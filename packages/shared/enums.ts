import { z } from "zod";

/** حكومية / منظمة / شركة / فرد (§6.16). */
export const ORG_TYPES = [
  "government",
  "organization",
  "company",
  "individual",
] as const;

export const orgTypeSchema = z.enum(ORG_TYPES);

export type OrgType = z.infer<typeof orgTypeSchema>;

export const LOCALES = ["ar", "en"] as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;

export const PROFILE_STATUSES = ["active", "disabled"] as const;

export const profileStatusSchema = z.enum(PROFILE_STATUSES);

export type ProfileStatus = z.infer<typeof profileStatusSchema>;
