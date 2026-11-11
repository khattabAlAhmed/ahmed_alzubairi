import type { Locale } from "@repo/shared";

export type TemplateText = { subject: string; body: string };

/**
 * The one built-in template, used for every event that has no
 * `email_templates` row. It is a stand-in so sending works end to end:
 * P3T-T12 replaces it with the default copy of each event in `apps/web/emails`.
 * It uses no placeholder, so it fits any event's payload.
 */
export const FALLBACK_TEMPLATE: Record<Locale, TemplateText> = {
  ar: {
    subject: "إشعار جديد",
    body: "لديك إشعار جديد. سجّل الدخول إلى حسابك لعرض التفاصيل.",
  },
  en: {
    subject: "New notification",
    body: "You have a new notification. Sign in to your account to see the details.",
  },
};
