/** Max size of one consultation attachment: 10 MB (§6.17, §14 #4). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Max files on one consultation message (§6.17, §14 #4). */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/** How long a signed document URL lasts (§6.18, §9). */
export const SIGNED_URL_TTL_SECONDS = 60;

/** The hourly job deletes watermarked copies older than this (§6.18). */
export const DOCUMENT_VIEW_COPY_TTL_HOURS = 1;

/** The meeting reminder goes out this long before the meeting (§6.17). */
export const MEETING_REMINDER_HOURS_BEFORE = 24;

/** Digits allowed in a phone number, not counting a leading + (§6.16). */
export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;

/** Max length of the free-text profile fields: org name and job title. */
export const MAX_PROFILE_TEXT_LENGTH = 200;
