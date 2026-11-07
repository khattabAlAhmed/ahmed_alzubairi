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

export const CONTENT_STATUSES = ["draft", "published"] as const;

export const contentStatusSchema = z.enum(CONTENT_STATUSES);

export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const CONSULTATION_KINDS = ["consultation", "document_request"] as const;

export const consultationKindSchema = z.enum(CONSULTATION_KINDS);

export type ConsultationKind = z.infer<typeof consultationKindSchema>;

/** In order (§6.17). */
export const CONSULTATION_STATUSES = [
  "new",
  "in_review",
  "in_progress",
  "scheduled",
  "closed",
] as const;

export const consultationStatusSchema = z.enum(CONSULTATION_STATUSES);

export type ConsultationStatus = z.infer<typeof consultationStatusSchema>;

export const DOCUMENT_CATEGORIES = [
  "course_certificate",
  "qualification_certificate",
  "thank_you_letter",
  "recommendation_letter",
  "experience_certificate",
  "project_photo",
  "event_photo",
] as const;

export const documentCategorySchema = z.enum(DOCUMENT_CATEGORIES);

export type DocumentCategory = z.infer<typeof documentCategorySchema>;

export const DOCUMENT_ACCESS_MODES = ["view", "view_download"] as const;

export const documentAccessModeSchema = z.enum(DOCUMENT_ACCESS_MODES);

export type DocumentAccessMode = z.infer<typeof documentAccessModeSchema>;

export const DOCUMENT_OPEN_ACTIONS = ["view", "download"] as const;

export const documentOpenActionSchema = z.enum(DOCUMENT_OPEN_ACTIONS);

export type DocumentOpenAction = z.infer<typeof documentOpenActionSchema>;

export const DOCUMENT_RECOMMENDATIONS = [
  "approve",
  "needs_clarification",
] as const;

export const documentRecommendationSchema = z.enum(DOCUMENT_RECOMMENDATIONS);

export type DocumentRecommendation = z.infer<
  typeof documentRecommendationSchema
>;

export const COURSE_TYPES = [
  "in_person",
  "online_live",
  "recorded",
  "custom",
] as const;

export const courseTypeSchema = z.enum(COURSE_TYPES);

export type CourseType = z.infer<typeof courseTypeSchema>;

/** Where a signup came from (§6.15, §6.9). */
export const NEWSLETTER_SOURCES = [
  "footer",
  "home",
  "blog",
  "resource",
] as const;

export const newsletterSourceSchema = z.enum(NEWSLETTER_SOURCES);

export type NewsletterSource = z.infer<typeof newsletterSourceSchema>;

/** The emails of §6.21, in the order of its table. */
export const EMAIL_EVENTS = [
  "consultation_new",
  "consultation_received",
  "consultation_assigned",
  "consultation_reply",
  "meeting",
  "meeting_reminder",
  "document_request",
  "document_recommendation",
  "document_granted",
  "course_registration",
  "custom_training_request",
  "contact_message",
  "account_new",
] as const;

export const emailEventSchema = z.enum(EMAIL_EVENTS);

export type EmailEvent = z.infer<typeof emailEventSchema>;
