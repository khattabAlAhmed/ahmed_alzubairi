import { emailEventSchema, type EmailEvent } from "@repo/shared";

/** The dashboard sections a notification can lead to. */
export type NotificationSection = "messages" | "overview";

const SECTION_PATHS: Record<NotificationSection, string> = {
  messages: "/dashboard/messages",
  overview: "/dashboard",
};

/**
 * The section a notification's `entity` belongs to. An entity whose section
 * isn't built yet (consultations, document requests, training, clients) leads
 * to the overview; add its line here when the section ships.
 */
const SECTION_OF_ENTITY = new Map<string, NotificationSection>([
  ["contact_messages", "messages"],
]);

/** Where a notification leads: the section and its path, without the locale. */
export function notificationTarget(entity: string | null): {
  section: NotificationSection;
  href: string;
} {
  const section = (entity && SECTION_OF_ENTITY.get(entity)) || "overview";
  return { section, href: SECTION_PATHS[section] };
}

/** The label key of a notification's `type`: the event, or `other`. */
export function notificationTypeKey(type: string): EmailEvent | "other" {
  const parsed = emailEventSchema.safeParse(type);
  return parsed.success ? parsed.data : "other";
}
