/**
 * The consultation form's address and its query key. A plain module, not a
 * client one: a server component importing a constant from a "use client"
 * file gets a client reference instead of the value.
 */

/** The query parameter the consultation form reads to preselect a service. */
export const SERVICE_PARAM = "service";

/** The new-consultation form. */
export const NEW_CONSULTATION_PATH = "/account/consultations/new";
