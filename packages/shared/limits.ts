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

/** Max length of names, titles, subjects and other one-line form fields. */
export const MAX_SHORT_TEXT_LENGTH = 200;

/** Max length of messages, descriptions, purposes and notes. */
export const MAX_LONG_TEXT_LENGTH = 5000;

/** Rows on one page of a dashboard list, when the request doesn't say. */
export const DEFAULT_PAGE_SIZE = 20;

/** The most rows one page of a dashboard list may ask for. */
export const MAX_PAGE_SIZE = 100;

/** The most notifications one `POST /api/notifications/read` may name. */
export const MAX_NOTIFICATION_IDS = 100;

/** Sends tried for one `email_outbox` row before the hourly job stops (§6.21). */
export const EMAIL_MAX_ATTEMPTS = 5;
